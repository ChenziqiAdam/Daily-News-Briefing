import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NewsItem, DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { GEMINI_MODEL_NAME } from '../../constants';
import type { AISummarizer } from './base-summarizer';

export class GeminiSummarizer implements AISummarizer {
    private settings: DailyNewsSettings;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.geminiApiKey) return { success: false, message: 'Gemini API key is not set.' };
        try {
            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
            await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 1 } });
            return { success: true, message: `Gemini (${GEMINI_MODEL_NAME}) connection successful.` };
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

        const prompt = this.getAIPrompt(enhancedNewsText, topic, this.settings.outputFormat);

        try {
            if (!this.settings.geminiApiKey) {
                throw new Error('Missing Gemini API key');
            }
            
            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            const model = genAI.getGenerativeModel({
                model: GEMINI_MODEL_NAME,
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.95,
                    topK: 40,
                }
            });
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI summary timed out')), 120000)
            );
            
            const resultPromise = model.generateContent(prompt);
            const result = await Promise.race([resultPromise, timeoutPromise]) as any;
            
            if (!result || !result.response) {
                throw new Error('Invalid AI response structure');
            }
            
            return result.response.text();
        } catch (error) {
            console.error('Failed to generate summary:', error);
            return `Error generating summary for ${topic}. ${error.message || 'Unknown error'}\n\nCheck the developer console for more information.`;
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
            let formattedPrompt = basePrompt + `\n\nFormat your summary with these sections:\n\n### ${LanguageUtils.getTranslation('keyDevelopments', this.settings.language)}\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n`;

            if (this.settings.enableAnalysisContext) {
                formattedPrompt += `\n\n### ${LanguageUtils.getTranslation('analysisContext', this.settings.language)}\n[Provide context, implications, or background for the most significant developments]`;
            }
            
            return formattedPrompt;
        } else {
            return basePrompt + `\n\nFormat your summary as bullet points with concrete facts:\n\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)\n- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
        }
    }
}
