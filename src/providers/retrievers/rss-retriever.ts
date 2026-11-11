import type { NewsItem, DailyNewsSettings } from '../../types';
import type { NewsRetriever } from './base-retriever';
import { requestText } from '../request-policy';
import { parseFeed } from './feed-parser';
import type { Feed, FeedItem } from './feed-parser';
import { filterRecentNews } from '../../briefing';

const SNIPPET_LENGTH = 1500;
// Words that describe every feed item and therefore cannot distinguish a topic.
const GENERIC_WORDS = new Set(['news', 'latest', 'update', 'updates', 'recent', 'today', 'the', 'and', 'for']);
const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/**
 * Relevance of a feed item to a topic: 3 = whole phrase, 2 = every keyword, 1 = some keyword, 0 = unrelated.
 * Latin keywords match word prefixes ("chip" finds "chips", "art" does not find "start").
 */
export function topicScore(item: Pick<FeedItem, 'title' | 'content' | 'categories'>, topic: string): number {
    const phrase = topic.trim().toLowerCase();
    if (!phrase) return 1;
    const text = `${item.title} ${item.content} ${item.categories.join(' ')}`.toLowerCase();
    const words = phrase.split(/\s+/).filter(word => word.length > 2 || CJK.test(word));
    const specific = words.filter(word => !GENERIC_WORDS.has(word));
    const keywords = specific.length ? specific : words;
    const split = (value: string) => value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const tokens = split(text);
    // The phrase must start at a word boundary, except in scripts written without spaces.
    if (CJK.test(phrase) ? text.includes(phrase) : ` ${tokens.join(' ')}`.includes(` ${split(phrase).join(' ')}`)) return 3;
    if (!keywords.length) return 0;
    const matched = keywords.filter(keyword => CJK.test(keyword) ? text.includes(keyword) : tokens.some(token => token.startsWith(keyword))).length;
    return matched === keywords.length ? 2 : matched ? 1 : 0;
}

export class RSSRetriever implements NewsRetriever {
    private settings: DailyNewsSettings;
    /** One download per feed per run, shared by all topics (including concurrent ones). */
    private feeds = new Map<string, Promise<Feed | null>>();
    public _lastFailedFeeds: string[] = [];

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
    }

    private loadFeed(feedUrl: string): Promise<Feed | null> {
        let feed = this.feeds.get(feedUrl);
        if (!feed) {
            // Obsidian's transport works on desktop and mobile and is not subject to CORS.
            feed = requestText({
                url: feedUrl,
                headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
            }, this.settings).then(parseFeed).catch(error => {
                console.error(`Error fetching RSS feed ${feedUrl}:`, error);
                return null;
            });
            this.feeds.set(feedUrl, feed);
        }
        return feed;
    }

    async fetchNews(topic: string): Promise<NewsItem[]> {
        const startTime = Date.now();

        if (!this.settings.rssFeeds || this.settings.rssFeeds.length === 0) {
            throw new Error('No RSS feeds configured. Please add RSS feed URLs in settings.');
        }

        const feedUrls = [...new Set(this.settings.rssFeeds)];
        const feeds = await Promise.all(feedUrls.map(feedUrl => this.loadFeed(feedUrl)));
        const failedFeeds = feedUrls.filter((_, index) => !feeds[index]);
        if (failedFeeds.length === feedUrls.length) {
            throw new Error(`All RSS feeds failed to load:\n${failedFeeds.join('\n')}`);
        }
        // Stored so callers can surface partial failures; identical for every topic in a run.
        this._lastFailedFeeds = failedFeeds;

        const scored: Array<{ item: NewsItem; score: number; time: number }> = [];
        const seen = new Set<string>();
        feeds.forEach((feed, index) => {
            for (const feedItem of feed?.items ?? []) {
                const score = topicScore(feedItem, topic);
                if (!score || seen.has(feedItem.link)) continue;
                seen.add(feedItem.link);
                const item = this.convertToNewsItem(feedItem, feed?.title || feedUrls[index]);
                const time = item.publishedTime ? Date.parse(item.publishedTime) : NaN;
                scored.push({ item, score, time: Number.isFinite(time) ? time : 0 });
            }
        });

        // Most relevant first, then newest; the date window is applied before the limit.
        scored.sort((a, b) => b.score - a.score || b.time - a.time);
        const recent = filterRecentNews(scored.map(entry => entry.item), this.settings);
        const limitedResults = recent.slice(0, this.settings.resultsPerTopic);

        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`RSS Retriever: ${scored.length} matching items, ${limitedResults.length} kept for ${topic} in ${elapsedTime}s`);

        return limitedResults;
    }

    private convertToNewsItem(item: FeedItem, feedSource: string): NewsItem {
        let snippet = this.cleanContent(item.content);
        if (snippet.length > SNIPPET_LENGTH) {
            snippet = snippet.substring(0, SNIPPET_LENGTH - 3) + '...';
        }

        return {
            title: item.title || 'Untitled',
            link: item.link,
            snippet: snippet,
            publishedTime: item.published,
            source: feedSource
        };
    }

    private cleanContent(text: string): string {
        if (!text) return '';

        return text
            .replace(/<[^>]*>/g, ' ') // Remove HTML tags
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
            .replace(/https?:\/\/\S+/g, '') // Remove URLs
            .replace(/\S+@\S+\.\S+/g, '') // Remove emails
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
}
