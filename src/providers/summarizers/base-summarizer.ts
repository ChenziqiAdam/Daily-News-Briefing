import type { BriefingResult } from '../../briefing';
import type { NewsItem } from '../../types';

export interface AISummarizer {
    summarize(newsItems: NewsItem[], topic: string): Promise<BriefingResult>;
}
