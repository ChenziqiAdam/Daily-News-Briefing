import OpenAI from 'openai';
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { OPENROUTER_API_URL, OPENROUTER_DEFAULT_MODEL } from '../../constants';

export class OpenRouterAgenticProvider extends BaseNewsProvider {
    constructor(settings: DailyNewsSettings) {
        super(settings);
    }

    getProviderName(): string {
        return 'OpenRouter (Agentic Search)';
    }

    validateConfiguration(): boolean {
        return !!this.settings.openrouterApiKey;
    }

    private getClient(): OpenAI {
        return new OpenAI({
            baseURL: `${OPENROUTER_API_URL}/chat/completions`.replace('/chat/completions', ''),
            apiKey: this.settings.openrouterApiKey,
            dangerouslyAllowBrowser: true, // Required for Obsidian's Electron environment
            defaultHeaders: {
                'HTTP-Referer': 'https://obsidian.md', // Attribution header for OpenRouter
                'X-Title': 'Obsidian Daily News Briefing',
            },
        });
    }

    private getModel(): string {
        return this.settings.openrouterModel || OPENROUTER_DEFAULT_MODEL;
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        if (!this.settings.openrouterApiKey) {
            return `Error: OpenRouter API key is not configured. Please add your API key in the plugin settings.`;
        }

        try {
            const client = this.getClient();
            const model = this.getModel();

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

            const response = await client.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemMessage,
                    },
                    {
                        role: 'user',
                        content: userContent,
                    }
                ],
            });

            // Extract text content from the response
            const content = response.choices[0]?.message?.content;
            if (content) {
                return content;
            } else {
                throw new Error('Invalid response format from OpenRouter API');
            }

        } catch (error: any) {
            console.error('OpenRouter API error:', error);

            // Provide actionable error messages
            if (error?.status === 401 || error?.code === 401) {
                return `Error fetching news about ${topic}: Invalid API key. Please check your OpenRouter API key in settings.`;
            }

            if (error?.status === 429 || error?.code === 429) {
                return `Error fetching news about ${topic}: Rate limit exceeded. Please try again later or check your API usage.`;
            }

            if (error?.status === 503 || error?.code === 503) {
                return `Error fetching news about ${topic}: Model unavailable. Please try a different model or try again later.`;
            }

            return `Error fetching news about ${topic} from OpenRouter API. Please check your API key and settings.\n\nError details: ${error?.message || 'Unknown error'}\n\nCheck the developer console for more information.`;
        }
    }
}
