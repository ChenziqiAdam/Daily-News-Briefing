import OpenAI from "openai";
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { GPT_MODEL_NAME, OPENAI_API_URL } from '../../constants';

export class GptAgenticProvider extends BaseNewsProvider {
    private client: OpenAI;

    constructor(settings: DailyNewsSettings) {
        super(settings);
        this.client = new OpenAI({
            apiKey: this.settings.openaiApiKey,
            baseURL: OPENAI_API_URL,
            dangerouslyAllowBrowser: true
        });
    }

    getProviderName(): string {
        return 'GPT (Agentic Search)';
    }

    validateConfiguration(): boolean {
        return !!this.settings.openaiApiKey;
    }


    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.openaiApiKey) return { success: false, message: 'OpenAI API key is not set.' };
        try {
            await this.client.responses.create({
                model: GPT_MODEL_NAME,
                input: 'hi',
            });
            return { success: true, message: `OpenAI (${GPT_MODEL_NAME}) connection successful.` };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Unknown error.' };
        }
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        try {
            let systemMessage: string;

            if (this.settings.useCustomPrompt && this.settings.customPrompt) {
                systemMessage = this.settings.customPrompt.replace(/{{TOPIC}}/g, topic);
            } else {
                const languageInstruction = this.settings.language !== 'en' ?
                    `Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';

                systemMessage = `You are a helpful AI assistant. Please answer in the required format.${languageInstruction}

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
            
            const completion = await this.client.responses.create({
                model: GPT_MODEL_NAME,
                tools: [{ type: 'web_search' }],
                instructions: systemMessage,
                input: userContent,
            });

            const content = completion.output_text;
            if (content) {
                return content;
            } else {
                throw new Error('Invalid response format from OpenAI API');
            }

        } catch (error) {
            console.error('OpenAI API error:', error);
            return `Error fetching news about ${topic} from OpenAI API. Please check your API key and settings.\n\nError details: ${error.message}\n\nCheck the developer console for more information.`;
        }
    }
}