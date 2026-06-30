import Anthropic from '@anthropic-ai/sdk';
import type { NewsItem, DailyNewsSettings } from '../../types';
import { LanguageUtils, PresetUtils } from '../../utils';
import type { AISummarizer } from './base-summarizer';
import { CLAUDE_MODEL_NAME } from '../../constants';

export class ClaudeSummarizer implements AISummarizer {
    private settings: DailyNewsSettings;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.settings.anthropicApiKey) return { success: false, message: 'Anthropic API key is not set.' };
        try {
            const client = new Anthropic({ apiKey: this.settings.anthropicApiKey, dangerouslyAllowBrowser: true });
            await client.messages.create({
                model: CLAUDE_MODEL_NAME,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'hi' }],
            });
            return { success: true, message: `Anthropic (${CLAUDE_MODEL_NAME}) connection successful.` };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error.';
            return { success: false, message: message };
        }
    }

    async summarize(newsItems: NewsItem[], topic: string): Promise<string> {
        if (newsItems.length === 0) {
            return `${LanguageUtils.getTranslation('noRecentNews', this.settings.language)} ${topic}`;
        }

        try {
            const client = new Anthropic({ apiKey: this.settings.anthropicApiKey, dangerouslyAllowBrowser: true });
            
            const newsText = newsItems.map((item, idx) => 
                `[${idx + 1}] ${item.title}\nSource: ${item.source || 'Unknown'}\nContent: ${item.snippet}\nURL: ${item.link}`
            ).join('\n\n');

            const languageInstruction = this.settings.language !== 'en' ? 
                `Translate all content into the language with ISO 639-1 code "${this.settings.language}".` : '';

            let systemPrompt: string;
            
            if (this.settings.useCustomPrompt && this.settings.customPrompt) {
                systemPrompt = this.settings.customPrompt.replace(/{{TOPIC}}/g, topic);
            } else {
                systemPrompt = `You are a helpful AI assistant that summarizes news. ${languageInstruction}
                
KEY REQUIREMENTS:
1. Focus on concrete developments, facts, and data
2. For each news item include the SOURCE in markdown format: [Source](URL)
3. Use specific dates rather than relative time references
4. Prioritize news with specific details (numbers, names, quotes)
5. Only return the news - do not include any meta-narratives, explanations, or instructions.`;
                systemPrompt += PresetUtils.getPromptGuidance(this.settings);

                if (this.settings.outputFormat === 'detailed') {
                    systemPrompt += `

Format your summary with these sections:

### ${LanguageUtils.getTranslation('keyDevelopments', this.settings.language)}
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;

                    if (this.settings.enableAnalysisContext) {
                        systemPrompt += `

### ${LanguageUtils.getTranslation('analysisContext', this.settings.language)}
[Provide context, implications, or background for the most significant developments]`;
                    }
                } else {
                    systemPrompt += `

Format your summary as bullet points with concrete facts:

- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
                }
            }

            const response = await client.messages.create({
                model: CLAUDE_MODEL_NAME,
                max_tokens: 4000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: `Summarize the following news about "${topic}":\n\n${newsText}` }
                ]
            });

            const content = response.content[0];
            if (content.type === 'text') {
                return content.text;
            } else {
                throw new Error('Invalid response format from Claude');
            }
        } catch (error) {
            console.error('Claude summarization error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            return `Error summarizing news about ${topic}: ${message}`;
        }
    }
}
