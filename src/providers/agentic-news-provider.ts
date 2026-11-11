import { BaseNewsProvider } from './base-news-provider';
import type { DailyNewsSettings } from '../types';
import { failure, researchPrompt, emptyUsage } from '../briefing';
import type { BriefingResult } from '../briefing';
import { ModelClient } from './model-client';
import type { ModelKind } from './native-response';
import { StructuredSummarizer } from './structured-summarizer';

export class AgenticNewsProvider extends BaseNewsProvider {
    private client: ModelClient;
    constructor(settings: DailyNewsSettings, private kind: ModelKind) { super(settings); this.client = new ModelClient(settings, kind); }
    getProviderName(): string { return `${this.kind} (Agentic Search)`; }
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.client.generate('Search for the official website of your API provider and cite it.', true);
            return { success: true, message: `${this.kind} (${this.client.model}) search request successful.` };
        } catch (error) { return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }; }
    }
    async fetchAndSummarizeNews(topic: string): Promise<BriefingResult> {
        let usage = emptyUsage();
        try {
            const research = await this.client.generate(researchPrompt(topic, this.settings), true);
            usage = research.usage;
            // Sonar may search again while formatting. Other providers format without search tools.
            return new StructuredSummarizer(this.settings, this.kind).summarizeSources(research.sources, topic, research.text, usage);
        } catch (error) { return failure(error, usage); }
    }
}
