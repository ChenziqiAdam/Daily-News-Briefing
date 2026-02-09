import Anthropic from '@anthropic-ai/sdk';
import type { NewsItem, DailyNewsSettings } from '../../types';
import { LanguageUtils } from '../../utils';
import type { AISummarizer } from './base-summarizer';
import { CLAUDE_MODEL_NAME, ANTHROPIC_API_URL } from '../../constants';

export class ClaudeSummarizer implements AISummarizer {
    private settings: DailyNewsSettings;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
    }

    async summarize(newsItems: NewsItem[], topic: string): Promise<string> {
        if (!newsItems.length) {
            return `No recent news found for ${topic}.`;
        }

        if (!this.settings.anthropicApiKey) {
            return `Error: Anthropic API key is not configured. Please add your API key in the plugin settings.`;
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
            const client = new Anthropic({
                apiKey: this.settings.anthropicApiKey,
                maxRetries: 2,
                dangerouslyAllowBrowser: true, // Required for Obsidian's Electron environment
            });

            const response = await client.messages.create({
                model: CLAUDE_MODEL_NAME,
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    }
                ],
            });

            // Extract text content from the response
            const textContent = response.content.find(block => block.type === 'text');
            if (textContent && textContent.type === 'text') {
                return textContent.text;
            } else {
                throw new Error('Invalid AI response structure');
            }
        } catch (error: any) {
            console.error('Claude Summarizer error:', error);

            // Provide actionable error messages
            if (error?.status === 401 || error?.error?.type === 'authentication_error') {
                return `Error summarizing news about ${topic}: Invalid API key. Please check your Anthropic API key in settings.`;
            }

            if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
                return `Error summarizing news about ${topic}: Rate limit exceeded. Please try again later.`;
            }

            return `Error generating summary for ${topic}. ${error?.message || 'Unknown error'}\n\nCheck the developer console for more information.`;
        }
    }

    private getAIPrompt(newsText: string, topic: string, format: 'detailed' | 'concise'): string {
        if (this.settings.useCustomPrompt && this.settings.customPrompt && newsText) {
            return this.settings.customPrompt.replace('{{NEWS_TEXT}}', newsText);
        }

        const languageInstruction = this.settings.language !== 'en' ?
            ` Translate all content into the language with ISO 639-1 code "${this.settings.language}". The source news may be in English but your response should be entirely in the target language.` : '';

        let basePrompt = `Analyze these news articles about ${topic} and provide a substantive summary.${languageInstruction}\n\n${newsText}\n\nKEY REQUIREMENTS:\n1. Focus on concrete developments, facts, and data\n2. For each news item include the SOURCE in markdown format: [Source](URL)\n3. Use specific dates rather than relative time references\n4. Prioritize news with specific details (numbers, names, quotes)\n5. If content lacks substance, state "${LanguageUtils.getTranslation('limitedNews', this.settings.language)} ${topic}"`;

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
