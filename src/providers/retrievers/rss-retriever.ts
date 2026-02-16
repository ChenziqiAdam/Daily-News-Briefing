import type { NewsItem, DailyNewsSettings } from '../../types';
import type { NewsRetriever } from './base-retriever';

// @ts-ignore
const Parser = require('rss-parser');

export class RSSRetriever implements NewsRetriever {
    private settings: DailyNewsSettings;
    private parser: any;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
        this.parser = new Parser({
            timeout: 10000,
            headers: {
                'User-Agent': 'Obsidian Daily News Plugin'
            }
        });
    }

    async fetchNews(topic: string): Promise<NewsItem[]> {
        const startTime = Date.now();

        if (!this.settings.rssFeeds || this.settings.rssFeeds.length === 0) {
            throw new Error('No RSS feeds configured. Please add RSS feed URLs in settings.');
        }

        const allNews: NewsItem[] = [];

        // Fetch from all configured RSS feeds
        await Promise.all(this.settings.rssFeeds.map(async (feedUrl) => {
            try {
                const feed = await this.parser.parseURL(feedUrl);

                // Filter items by topic relevance
                const relevantItems = this.filterByTopic(feed.items || [], topic);

                // Convert to NewsItem format
                for (const item of relevantItems) {
                    const newsItem = this.convertToNewsItem(item, feed.title || feedUrl);

                    // Avoid duplicates by checking link
                    if (!allNews.some(existing => existing.link === newsItem.link)) {
                        allNews.push(newsItem);
                    }
                }

            } catch (error) {
                console.error(`Error fetching RSS feed ${feedUrl}:`, error);
            }
        }));

        // Sort by published date (newest first)
        allNews.sort((a, b) => {
            const dateA = a.publishedTime ? new Date(a.publishedTime).getTime() : 0;
            const dateB = b.publishedTime ? new Date(b.publishedTime).getTime() : 0;
            return dateB - dateA;
        });

        // Apply date range filter
        const filteredByDate = this.filterByDateRange(allNews);

        // Limit to configured results per topic
        const limitedResults = filteredByDate.slice(0, this.settings.resultsPerTopic);

        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`RSS Retriever: Fetched ${allNews.length} total items, filtered to ${limitedResults.length} items for ${topic} in ${elapsedTime}s`);

        return limitedResults;
    }

    private filterByTopic(items: any[], topic: string): any[] {
        const topicLower = topic.toLowerCase();
        const topicKeywords = topicLower.split(' ').filter(word => word.length > 2);

        return items.filter(item => {
            const title = (item.title || '').toLowerCase();
            const content = (item.contentSnippet || item.content || '').toLowerCase();
            const categories = (item.categories || []).map((cat: any) => cat.toLowerCase());

            // Check if topic keywords match in title, content, or categories
            const matchesKeywords = topicKeywords.some(keyword =>
                title.includes(keyword) ||
                content.includes(keyword) ||
                categories.some((cat: string) => cat.includes(keyword))
            );

            // Also check exact topic match
            const exactMatch = title.includes(topicLower) ||
                               content.includes(topicLower) ||
                               categories.some((cat: string) => cat.includes(topicLower));

            return exactMatch || matchesKeywords;
        });
    }

    private convertToNewsItem(item: any, feedSource: string): NewsItem {
        // Extract published time
        const publishedTime = item.pubDate || item.isoDate || item.published || '';

        // Extract content snippet
        let snippet = item.contentSnippet || item.summary || item.description || '';

        // Clean and truncate snippet
        snippet = this.cleanContent(snippet);
        if (snippet.length > 300) {
            snippet = snippet.substring(0, 297) + '...';
        }

        return {
            title: item.title || 'Untitled',
            link: item.link || item.guid || '',
            snippet: snippet,
            publishedTime: publishedTime,
            source: feedSource
        };
    }

    private cleanContent(text: string): string {
        if (!text) return '';

        return text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/https?:\/\/\S+/g, '') // Remove URLs
            .replace(/\S+@\S+\.\S+/g, '') // Remove emails
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    private filterByDateRange(items: NewsItem[]): NewsItem[] {
        // Parse date range setting (e.g., 'd3' = 3 days, 'w1' = 1 week)
        const dateRangeMatch = this.settings.dateRange.match(/^([dw])(\d+)$/);
        if (!dateRangeMatch) {
            return items; // No filtering if format is invalid
        }

        const unit = dateRangeMatch[1];
        const amount = parseInt(dateRangeMatch[2]);

        const now = new Date();
        const cutoffDate = new Date();

        if (unit === 'd') {
            cutoffDate.setDate(now.getDate() - amount);
        } else if (unit === 'w') {
            cutoffDate.setDate(now.getDate() - (amount * 7));
        }

        return items.filter(item => {
            if (!item.publishedTime) return true; // Keep items without date

            const itemDate = new Date(item.publishedTime);
            return itemDate >= cutoffDate;
        });
    }
}
