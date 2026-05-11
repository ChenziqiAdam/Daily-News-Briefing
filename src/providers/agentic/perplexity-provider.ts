import { requestUrl } from 'obsidian';
import { BaseNewsProvider } from '../base-news-provider';
import type { DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import { PERPLEXITY_API_URL, PERPLEXITY_MODEL_NAME } from '../../constants';

export class PerplexityNewsProvider extends BaseNewsProvider {
    constructor(settings: DailyNewsSettings) {
        super(settings);
    }

    getProviderName(): string {
        return 'Sonar by Perplexity';
    }

    validateConfiguration(): boolean {
        return !!this.settings.perplexityApiKey;
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.perplexityApiKey) return { success: false, message: 'Perplexity API key is not set.' };
        try {
            const response = await requestUrl({
                url: PERPLEXITY_API_URL,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: PERPLEXITY_MODEL_NAME,
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 1,
                }),
            });
            if (response.status >= 200 && response.status < 300) {
                return { success: true, message: `Perplexity (${PERPLEXITY_MODEL_NAME}) connection successful.` };
            }
            const err = JSON.parse(response.text);
            return { success: false, message: `Error ${response.status}: ${err?.error?.message || response.text}` };
        } catch (error: any) {
            return { success: false, message: error?.message || 'Unknown error.' };
        }
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        try {
            // Build system message based on output format
            let systemMessage = this.getAIPrompt('', topic, this.settings.outputFormat);
            
            // Prepare request body - Always search in English but translate results to target language
            const requestBody = {
                model: PERPLEXITY_MODEL_NAME,
                messages: [
                    {
                        role: "system",
                        content: systemMessage
                    },
                    {
                        role: "user",
                        content: this.settings.language !== 'en' ? 
                            `What are the latest significant news about "${topic}"? Search for information in English, but translate your final response into the language with ISO 639-1 code "${this.settings.language}".` :
                            `What are the latest significant news about "${topic}"?`
                    }
                ],
            };
            
            // Make API request to Sonar
            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            };
            
            const response = await requestUrl({
                url: PERPLEXITY_API_URL,
                ...options
            });
            
            if (response.status >= 200 && response.status < 300) {
                const data = JSON.parse(response.text);
                if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                    return data.choices[0].message.content;
                } else {
                    throw new Error('Invalid response format from Sonar API');
                }
            } else {
                throw new Error(`Sonar API returned status ${response.status}: ${response.text}`);
            }
        } catch (error) {
            console.error('Sonar API error:', error);
            return `Error fetching news about ${topic} from Sonar API. Please check your API key and settings.\n\nError details: ${error.message}\n\nCheck the developer console for more information.`;
        }
    }

    private getAIPrompt(newsText: string, topic: string, format: 'detailed' | 'concise'): string {
        // If user has custom prompt enabled and provided one, use it
        if (this.settings.useCustomPrompt && this.settings.customPrompt) {
            // For Sonar, we don't need to replace {{NEWS_TEXT}} since it handles search internally
            return this.settings.customPrompt;
        }
        
        // Language instruction - Make it clear to translate from English to target language if needed
        const languageInstruction = this.settings.language !== 'en' ? 
            ` Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';
        
        // For Sonar API, use a different prompt structure with explicit translation instruction
        let basePrompt = `You are a helpful AI assistant. Please answer in the required format.${languageInstruction}

        KEY REQUIREMENTS:
        1. Focus on concrete developments, facts, and data
        2. For each news item include the SOURCE in markdown format: [Source](URL)
        3. Use specific dates rather than relative time references
        4. Prioritize news with specific details (numbers, names, quotes)
        5. Only return the news - do not include any meta-narratives, explanations, or instructions. 
        6. If content lacks substance, state "${LanguageUtils.getTranslation('limitedNews', this.settings.language)}" ${topic}`;

        // Add format-specific instructions for Sonar
        if (format === 'detailed') {
            let formattedPrompt = basePrompt + `

Format your summary with these sections:

### ${LanguageUtils.getTranslation('keyDevelopments', this.settings.language)}
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;

            // Only add analysis section if the feature is enabled
            if (this.settings.enableAnalysisContext) {
                formattedPrompt += `

### ${LanguageUtils.getTranslation('analysisContext', this.settings.language)}
[Provide context, implications, or background for the most significant developments]`;
            }
            
            return formattedPrompt;
        } else {
            return basePrompt + `

Format your summary as bullet points with concrete facts:

- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
        }
    }
}
