import Anthropic from '@anthropic-ai/sdk';
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils, PresetUtils } from '../../utils';
import { CLAUDE_MODEL_NAME } from '../../constants';

type ContentBlock = Anthropic.Messages.ContentBlock;
type WebSearchToolResultBlock = Anthropic.Messages.WebSearchToolResultBlock;
type TextBlock = Anthropic.Messages.TextBlock;

export class ClaudeAgenticProvider extends BaseNewsProvider {
    constructor(settings: DailyNewsSettings) {
        super(settings);
    }

    getProviderName(): string {
        return 'Claude (Agentic Search)';
    }

    validateConfiguration(): boolean {
        return !!this.settings.anthropicApiKey;
    }

    private getClient(): Anthropic {
        // Create a new client each time to ensure settings changes are applied
        // and to avoid caching issues with different API keys
        return new Anthropic({
            apiKey: this.settings.anthropicApiKey,
            maxRetries: 2, // Limit retries to avoid long waits on rate limits
            dangerouslyAllowBrowser: true, // Required for Obsidian's Electron environment
        });
    }

    private getModel(): string {
        return this.settings.claudeModel || CLAUDE_MODEL_NAME;
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.anthropicApiKey) return { success: false, message: 'Anthropic API key is not set.' };
        const model = this.getModel();
        try {
            const client = this.getClient();
            await client.messages.create({
                model,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'hi' }],
            });
            return { success: true, message: `Anthropic (${model}) connection successful.` };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error.';
            return { success: false, message: message };
        }
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        if (!this.settings.anthropicApiKey) {
            return `Error: Anthropic API key is not configured. Please add your API key in the plugin settings.`;
        }

        try {
            const client = this.getClient();

            let systemMessage: string;

            if (this.settings.useCustomPrompt && this.settings.customPrompt) {
                systemMessage = this.settings.customPrompt.replace(/{{TOPIC}}/g, topic);
            } else {
                const languageInstruction = this.settings.language !== 'en' ?
                    `Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';

                systemMessage = `You are a helpful AI assistant that provides news summaries. ${languageInstruction}

KEY REQUIREMENTS:
1. Focus on concrete developments, facts, and data
2. For each news item include the SOURCE in markdown format: [Source](URL)
3. Use specific dates rather than relative time references
4. Prioritize news with specific details (numbers, names, quotes)
5. Only return the news - do not include any meta-narratives, explanations, or instructions.
6. If content lacks substance, state "${LanguageUtils.getTranslation('limitedNews', this.settings.language)} ${topic}"`;
                systemMessage += PresetUtils.getPromptGuidance(this.settings);

                if (this.settings.outputFormat === 'detailed') {
                    systemMessage += `

Format your summary with these sections:

### ${LanguageUtils.getTranslation('keyDevelopments', this.settings.language)}
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;

                    if (this.settings.enableAnalysisContext) {
                        systemMessage += `

### ${LanguageUtils.getTranslation('analysisContext', this.settings.language)}
[Provide context, implications, or background for the most significant developments]`;
                    }
                } else {
                    systemMessage += `

Format your summary as bullet points with concrete facts:

- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
                }
            }

            const userContent = this.settings.language !== 'en' ?
                `What are the latest significant news about "${topic}"? Search for information in English, but translate your final response into the language with ISO 639-1 code "${this.settings.language}".` :
                `What are the latest significant news about "${topic}"?`;

            const response = await client.messages.create({
                model: this.getModel(),
                max_tokens: 8192,
                system: systemMessage,
                tools: [
                    {
                        type: 'web_search_20250305',
                        name: 'web_search',
                        max_uses: 10,
                    }
                ],
                messages: [
                    {
                        role: 'user',
                        content: userContent,
                    }
                ],
            });

            // Log response metadata for debugging
            console.log('Claude API response:', {
                model: response.model,
                stop_reason: response.stop_reason,
                usage: response.usage,
                content_blocks: response.content.length,
                content_types: response.content.map((b: ContentBlock) => b.type)
            });

            // Check for web search errors in the response (only when content is error object, not array of results)
            const webSearchError = response.content.find(
                (block: ContentBlock): block is WebSearchToolResultBlock => {
                    if (block.type !== 'web_search_tool_result') return false;
                    const wsBlock = block as WebSearchToolResultBlock;
                    return !Array.isArray(wsBlock.content) && wsBlock.content.type === 'web_search_tool_result_error';
                }
            ) as WebSearchToolResultBlock | undefined;
            if (webSearchError && !Array.isArray(webSearchError.content)) {
                const errorCode = webSearchError.content.error_code;
                console.warn('Web search error:', errorCode);
                // Don't fail completely - Claude might still have provided a text response
            }

            // Extract ALL text content from the response (there may be multiple text blocks)
            const textBlocks = response.content.filter((block: ContentBlock): block is TextBlock => block.type === 'text');
            if (textBlocks.length > 0) {
                // Combine all text blocks
                const fullText = textBlocks.map((block) => block.text).join('\n');

                // Check if this is just a "sorry I can't search" response
                const isSearchUnavailableResponse = fullText.includes('ne peux pas accéder') ||
                    fullText.includes('cannot access') ||
                    fullText.includes('search tool is not available') ||
                    fullText.includes('recherche web n\'est pas disponible');

                if (isSearchUnavailableResponse && webSearchError) {
                    return `Error fetching news about ${topic}: Web search temporarily unavailable. This is an Anthropic service issue. Please try again later or use a different provider (e.g., "Google Search + Claude Summarizer").`;
                }

                // Warn if response might be truncated
                if (response.stop_reason === 'max_tokens') {
                    console.warn('Response was truncated due to max_tokens limit');
                } else if (response.stop_reason === 'pause_turn') {
                    console.warn('Response was paused - turn was too long');
                }

                return fullText;
            } else {
                throw new Error('Invalid response format from Claude API');
            }

        } catch (error) {
            console.error('Claude API error:', error);
            const err = error as { status?: number; error?: { type?: string; message?: string }; message?: string };

            // Provide actionable error messages
            if (err.status === 401 || err.error?.type === 'authentication_error') {
                return `Error fetching news about ${topic}: Invalid API key. Please check your Anthropic API key in settings.`;
            }

            if (err.status === 429 || err.error?.type === 'rate_limit_error') {
                return `Error fetching news about ${topic}: Rate limit exceeded. Please try again later or check your API usage.`;
            }

            if (err.status === 400 || err.error?.type === 'invalid_request_error') {
                return `Error fetching news about ${topic}: Invalid request. ${err.error?.message || 'Please check your settings.'}`;
            }

            return `Error fetching news about ${topic} from Claude API. Please check your API key and settings.\n\nError details: ${err.message || 'Unknown error'}\n\nCheck the developer console for more information.`;
        }
    }
}
