import { GoogleGenAI } from "@google/genai";
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { GEMINI_MODEL_NAME } from '../../constants';

export class GeminiAgenticProvider extends BaseNewsProvider {
    constructor(settings: DailyNewsSettings) {
        super(settings);
    }

    getProviderName(): string {
        return 'Gemini (Agentic Search)';
    }

    validateConfiguration(): boolean {
        return !!this.settings.geminiApiKey;
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        if (!this.settings.geminiApiKey) {
            return `Error: Gemini API key is not configured. Please add your API key in the plugin settings.`;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: this.settings.geminiApiKey });

            let systemInstruction: string;

            if (this.settings.useCustomPrompt && this.settings.customPrompt) {
                systemInstruction = this.settings.customPrompt.replace(/{{TOPIC}}/g, topic);
            } else {
                const languageInstruction = this.settings.language !== 'en' ?
                    `Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';

                systemInstruction = `You are a helpful AI assistant. Please answer in the required format.${languageInstruction}

KEY REQUIREMENTS:
1. Focus on concrete developments, facts, and data
2. For each news item include the SOURCE in markdown format: [Source](URL)
3. Use specific dates rather than relative time references
4. Prioritize news with specific details (numbers, names, quotes)
5. Only return the news - do not include any meta-narratives, explanations, or instructions.
6. If content lacks substance, state "${LanguageUtils.getTranslation('limitedNews', this.settings.language)} ${topic}"`;

                if (this.settings.outputFormat === 'detailed') {
                    systemInstruction += `

Format your summary with these sections:

### ${LanguageUtils.getTranslation('keyDevelopments', this.settings.language)}
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;

                    if (this.settings.enableAnalysisContext) {
                        systemInstruction += `

### ${LanguageUtils.getTranslation('analysisContext', this.settings.language)}
[Provide context, implications, or background for the most significant developments]`;
                    }
                } else {
                    systemInstruction += `

Format your summary as bullet points with concrete facts:

- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
                }
            }

            const userContent = this.settings.language !== 'en' ?
                `What are the latest significant news about "${topic}"? Search for information in English, but translate your final response into the language with ISO 639-1 code "${this.settings.language}".` :
                `What are the latest significant news about "${topic}"?`;

            const response = await ai.models.generateContent({
                model: GEMINI_MODEL_NAME,
                contents: `${systemInstruction}\n\n${userContent}`,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            const text = response.text;
            if (text) {
                return text;
            } else {
                throw new Error('Invalid response format from Gemini API');
            }

        } catch (error) {
            console.error('Gemini API error:', error);
            return `Error fetching news about ${topic} from Gemini API. Please check your API key and settings.\n\nError details: ${error.message}\n\nCheck the developer console for more information.`;
        }
    }
}
