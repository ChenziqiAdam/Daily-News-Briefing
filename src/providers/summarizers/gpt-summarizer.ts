import OpenAI from "openai";
import type { NewsItem, DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { GPT_MODEL_NAME, OPENAI_API_URL } from '../../constants';
import type { AISummarizer } from './base-summarizer';

export class GptSummarizer implements AISummarizer {
    private client: OpenAI;
    private settings: DailyNewsSettings;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
        this.client = new OpenAI({
            apiKey: this.settings.openaiApiKey,
            baseURL: OPENAI_API_URL,
            dangerouslyAllowBrowser: true
        });
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.openaiApiKey) return { success: false, message: 'OpenAI API key is not set.' };
        try {
            await this.client.chat.completions.create({
                model: GPT_MODEL_NAME,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 1,
            });
            return { success: true, message: `OpenAI (${GPT_MODEL_NAME}) connection successful.` };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Unknown error.' };
        }
    }

    async summarize(newsItems: NewsItem[], topic: string): Promise<string> {
        if (!newsItems.length) {
            return `No recent news found for ${topic}.`;
        }

        const enhancedNewsText = newsItems.map(item => {
            const domain = new URL(item.link).hostname.replace('www.', '');
            
            return `=== NEWS ITEM ===\n` +
                `Title: ${item.title}\n` +
                `Source: ${item.source || domain}\n` +
                `URL: ${item.link}\n` +
                `Published: ${item.publishedTime || 'Unknown'}\n` +
                `Content: ${item.snippet}\n`;
        }).join('\n\n');

        const systemMessage = this.getAIPrompt(enhancedNewsText, topic, this.settings.outputFormat);

        try {
            const completion = await this.client.chat.completions.create({
                model: GPT_MODEL_NAME,
                // NO web_search_options here, as this is purely for summarization
                messages: [{
                    "role": "system",
                    "content": systemMessage
                }],
            });

            const content = completion.choices[0].message.content;
            if (content) {
                return content;
            } else {
                throw new Error('Invalid response format from OpenAI API');
            }

        } catch (error) {
            console.error('OpenAI API error during summarization:', error);
            return `Error summarizing news about ${topic} from OpenAI API. Please check your API key and settings.\n\nError details: ${error.message}\n\nCheck the developer console for more information.`;
        }
    }

    private getAIPrompt(newsText: string, topic: string, format: 'detailed' | 'concise'): string {
        if (this.settings.useCustomPrompt && this.settings.customPrompt && newsText) {
            return this.settings.customPrompt.replace('{{NEWS_TEXT}}', newsText);
        }
        
        const languageInstruction = this.settings.language !== 'en' ? 
            ` Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';
        
        let basePrompt = `Analyze these news articles about ${topic} and provide a substantive summary.${languageInstruction}\n\n        ${newsText}\n\n        KEY REQUIREMENTS:\n        1. Focus on concrete developments, facts, and data\n        2. For each news item include the SOURCE in markdown format: [Source](URL)\n        3. Use specific dates rather than relative time references\n        4. Prioritize news with specific details (numbers, names, quotes)\n        5. If content lacks substance, state "${LanguageUtils.getTranslation('limitedNews', this.settings.language)} ${topic}"`;

        if (format === 'detailed') {
            let formattedPrompt = basePrompt + `\n\nFormat your summary with these sections:\n\n### ${LanguageUtils.getTranslation('keyDevelopments', this.settings.language)}
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n`;

            if (this.settings.enableAnalysisContext) {
                formattedPrompt += `\n### ${LanguageUtils.getTranslation('analysisContext', this.settings.language)}
[Provide context, implications, or background for the most significant developments]`;
            }
            
            return formattedPrompt;
        } else {
            return basePrompt + `\n\nFormat your summary as bullet points with concrete facts:\n\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
        }
    }
}
