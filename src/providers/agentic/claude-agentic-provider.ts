import Anthropic from '@anthropic-ai/sdk';
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { CLAUDE_MODEL_NAME, ANTHROPIC_API_URL } from '../../constants';

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
                model: CLAUDE_MODEL_NAME,
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
                content_types: response.content.map((b: any) => b.type)
            });

            // Check for web search errors in the response (only when content is error object, not array of results)
            const webSearchError = response.content.find(
                (block: any) => block.type === 'web_search_tool_result' &&
                    !Array.isArray(block.content) &&
                    block.content?.type === 'web_search_tool_result_error'
            );
            if (webSearchError && (webSearchError as any).content?.error_code) {
                const errorCode = (webSearchError as any).content.error_code;
                console.warn('Web search error:', errorCode);
                // Don't fail completely - Claude might still have provided a text response
            }

            // Extract ALL text content from the response (there may be multiple text blocks)
            const textBlocks = response.content.filter((block: any) => block.type === 'text');
            if (textBlocks.length > 0) {
                // Combine all text blocks
                const fullText = textBlocks.map((block: any) => block.text).join('\n');

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

        } catch (error: any) {
            console.error('Claude API error:', error);

            // Provide actionable error messages
            if (error?.status === 401 || error?.error?.type === 'authentication_error') {
                return `Error fetching news about ${topic}: Invalid API key. Please check your Anthropic API key in settings.`;
            }

            if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
                return `Error fetching news about ${topic}: Rate limit exceeded. Please try again later or check your API usage.`;
            }

            if (error?.status === 400 || error?.error?.type === 'invalid_request_error') {
                return `Error fetching news about ${topic}: Invalid request. ${error?.error?.message || 'Please check your settings.'}`;
            }

            return `Error fetching news about ${topic} from Claude API. Please check your API key and settings.\n\nError details: ${error?.message || 'Unknown error'}\n\nCheck the developer console for more information.`;
        }
    }
}
