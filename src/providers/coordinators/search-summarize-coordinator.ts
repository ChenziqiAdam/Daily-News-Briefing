import { BaseNewsProvider } from '../base-news-provider';
import type { NewsRetriever } from '../retrievers/base-retriever';
import type { AISummarizer } from '../summarizers/base-summarizer';
import { LanguageUtils } from '../../utils';
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
        return (this.retriever as any)._lastFailedFeeds ?? [];
    }

    async fetchAndSummarizeNews(topic: string): Promise<string> {
        // Reset failed feeds tracking before each call
        (this.retriever as any)._lastFailedFeeds = [];

        const newsItems = await this.retriever.fetchNews(topic);

        if (newsItems.length === 0) {
            return `${LanguageUtils.getTranslation('noRecentNews', this.settings.language)} ${topic}.`;
        }

        return await this.summarizer.summarize(newsItems, topic);
    }
}
