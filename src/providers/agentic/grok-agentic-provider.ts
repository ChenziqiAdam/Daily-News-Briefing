import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { GROK_MODEL_NAME } from '../../constants';

export class GrokAgenticProvider extends BaseNewsProvider {
    constructor(settings: DailyNewsSettings) {
        super(settings);
    }

    getProviderName(): string {
        return 'Grok (Agentic Search)';
    }

    validateConfiguration(): boolean {
        return !!this.settings.grokApiKey;
    }


    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.grokApiKey) return { success: false, message: 'Grok API key is not set.' };
        try {
            const xai = createXai({ apiKey: this.settings.grokApiKey });
            await generateText({
                model: xai.responses(GROK_MODEL_NAME),
                messages: [{ role: 'user', content: 'hi' }],
            });
            return { success: true, message: `Grok (${GROK_MODEL_NAME}) connection successful.` };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Unknown error.' };
        }
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        if (!this.settings.grokApiKey) {
            return `Error: Grok API key is not configured. Please add your API key in the plugin settings.`;
        }

        const xai = createXai({
            apiKey: this.settings.grokApiKey
        });

        try {
            let systemMessage: string;

            if (this.settings.useCustomPrompt && this.settings.customPrompt) {
                systemMessage = this.settings.customPrompt.replace(/{{TOPIC}}/g, topic);
            } else {
                const languageInstruction = this.settings.language !== 'en' ?
                    `Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';

                systemMessage = `You are a helpful AI assistant. Please answer in the required format.${languageInstruction}` +
`
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
            
            const { text, sources } = await generateText({
                model: xai.responses(GROK_MODEL_NAME),
                messages: [{
                    role: 'system',
                    content: systemMessage,
                },
                {
                    role: 'user',
                    content: userContent,
                }],
                tools: {
                    web_search: xai.tools.webSearch(),
                },
            });

            if (text) {
                return text;
            } else {
                throw new Error('Invalid response format from Grok API');
            }

        } catch (error) {
            console.error('Grok API error:', error);
            return `Error fetching news about ${topic} from Grok API. Please check your API key and settings.\n\nError details: ${error.message}\n\nCheck the developer console for more information.`;
        }
    }
}
