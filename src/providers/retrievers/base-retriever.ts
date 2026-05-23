import type { NewsItem } from '../../types';

export interface NewsRetriever {
    fetchNews(topic: string): Promise<NewsItem[]>;
    _lastFailedFeeds?: string[];
}
