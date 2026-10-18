import type { DailyNewsSettings, NewsItem } from '../types';
import { failure, parseBriefing, sourcesFromNews, summaryPrompt, emptyUsage, addUsage } from '../briefing';
import type { BriefingResult, NewsSource, Usage } from '../briefing';
import { ModelClient } from './model-client';
import type { ModelKind } from './native-response';
import type { AISummarizer } from './summarizers/base-summarizer';

export class StructuredSummarizer implements AISummarizer {
    protected client: ModelClient;
    constructor(protected settings: DailyNewsSettings, kind: ModelKind) {
        // Summarization uses the current free-text Gemini default even after native research.
        this.client = new ModelClient({ ...settings, pipelineMode: 'modular' }, kind);
    }
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.client.generate('Return JSON: {"items":[]}');
            return { success: true, message: `${this.client.kind} (${this.client.model}) text generation successful.` };
        } catch (error) { return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }; }
    }
    async summarize(items: NewsItem[], topic: string): Promise<BriefingResult> {
        return this.summarizeSources(sourcesFromNews(items), topic);
    }
    async summarizeSources(sources: NewsSource[], topic: string, research = '', usage: Usage = emptyUsage()): Promise<BriefingResult> {
        if (!sources.length) return { status: 'empty', items: [], sources: [], warnings: [], usage };
        try {
            const reply = await this.client.generate(summaryPrompt(topic, sources, this.settings, research));
            usage = addUsage(usage, reply.usage);
            return parseBriefing(reply.text, sources, this.settings, usage);
        } catch (error) { return failure(error, usage); }
    }
}
