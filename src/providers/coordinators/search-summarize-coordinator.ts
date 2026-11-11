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

    /** Returns feed URLs that failed during the current run (partial failures only). */
    getLastFailedFeeds(): string[] {
        return this.retriever._lastFailedFeeds ?? [];
    }

    async fetchAndSummarizeNews(topic: string): Promise<BriefingResult> {
        try {
            const newsItems = filterRecentNews(await this.retriever.fetchNews(topic), this.settings);
            const result = newsItems.length ? await this.summarizer.summarize(newsItems, topic)
                : { status: 'empty' as const, items: [], sources: [], warnings: [], usage: emptyUsage() };
            if (this.retriever._lastFailedFeeds?.length) result.warnings.push('partial_feeds');
            return result;
        } catch (error) { return failure(error); }
    }
}
