import { requestUrl } from 'obsidian';
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
            const response = await requestUrl({
                url: PERPLEXITY_SEARCH_API_URL,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: `${topic} news`,
                    max_results: this.settings.maxSearchResults,
                }),
            });

            const data = response.json as { results?: Array<{ title: string; url: string; snippet: string; date?: string }> };

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

                if (items.length >= this.settings.resultsPerTopic) break;
            }

            return items;
        } catch (error) {
            throw new Error(`Perplexity Search failed for "${topic}": ${error.message}`);
        }
    }
}
