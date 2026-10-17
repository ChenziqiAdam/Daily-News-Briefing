import { requestJson } from '../request-policy';
import { filterRecentNews, timeWindow } from '../../briefing';
import type { NewsItem, DailyNewsSettings } from '../../types';
import { PERPLEXITY_SEARCH_API_URL } from '../../constants';
import type { NewsRetriever } from './base-retriever';

export class PerplexitySearchRetriever implements NewsRetriever {
    private settings: DailyNewsSettings;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
    }

    async fetchNews(topic: string): Promise<NewsItem[]> {
        try {
            const { start, end } = timeWindow(this.settings.dateRange);
            const formatDate = (value: Date) => `${value.getUTCMonth() + 1}/${value.getUTCDate()}/${value.getUTCFullYear()}`;
            const response = await requestJson({
                url: PERPLEXITY_SEARCH_API_URL,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `${topic} news`,
                    max_results: Math.max(1, Math.min(20, this.settings.maxSearchResults)),
                    search_after_date_filter: formatDate(start),
                    search_before_date_filter: formatDate(new Date(end.getTime() + 86400000)),
                }),
            }, this.settings);

            const data = response as { results?: Array<{ title: string; url: string; snippet: string; date?: string }> };

            if (!data.results || !Array.isArray(data.results)) {
                throw new Error('Unexpected response format from Perplexity Search API');
            }

            const seen = new Set<string>();
            const items: NewsItem[] = [];

            for (const result of data.results) {
                if (seen.has(result.url)) continue;
                seen.add(result.url);

                let source: string | undefined;
                try {
                    source = new URL(result.url).hostname.replace(/^www\./, '');
                } catch {
                    source = undefined;
                }

                items.push({
                    title: result.title,
                    link: result.url,
                    snippet: result.snippet,
                    publishedTime: result.date,
                    source,
                });

            }

            return filterRecentNews(items, this.settings).slice(0, this.settings.resultsPerTopic);
        } catch (error) {
            throw new Error(`Perplexity Search failed for "${topic}": ${error.message}`);
        }
    }
}
