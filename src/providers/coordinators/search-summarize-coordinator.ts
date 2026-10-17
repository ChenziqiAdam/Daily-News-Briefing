import { BaseNewsProvider } from '../base-news-provider';
import type { NewsRetriever } from '../retrievers/base-retriever';
import type { AISummarizer } from '../summarizers/base-summarizer';
import { filterRecentNews, emptyUsage, failure } from '../../briefing';
import type { BriefingResult } from '../../briefing';
import type { DailyNewsSettings } from '../../types';

export class SearchSummarizeCoordinator extends BaseNewsProvider {
    private retriever: NewsRetriever;
    private summarizer: AISummarizer;
    private providerName: string;

    constructor(settings: DailyNewsSettings, retriever: NewsRetriever, summarizer: AISummarizer, providerName: string) {
        super(settings);
        this.retriever = retriever;
        this.summarizer = summarizer;
        this.providerName = providerName;
    }

    getProviderName(): string {
        return this.providerName;
    }

    validateConfiguration(): boolean {
        // This coordinator is dynamically created, so validation should be handled
        // in the factory based on the selected pipeline.
        // For simplicity, we assume if it's created, the config is valid.
        return true;
    }

    /** Returns feed URLs that failed during the last fetchAndSummarizeNews call (partial failures only). */
    getLastFailedFeeds(): string[] {
        return this.retriever._lastFailedFeeds ?? [];
    }

    async fetchAndSummarizeNews(topic: string): Promise<BriefingResult> {
        this.retriever._lastFailedFeeds = [];
        try {
            const newsItems = filterRecentNews(await this.retriever.fetchNews(topic), this.settings);
            const result = newsItems.length ? await this.summarizer.summarize(newsItems, topic)
                : { status: 'empty' as const, items: [], sources: [], warnings: [], usage: emptyUsage() };
            if (this.retriever._lastFailedFeeds?.length) result.warnings.push('partial_feeds');
            return result;
        } catch (error) { return failure(error); }
    }
}
