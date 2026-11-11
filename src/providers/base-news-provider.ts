import type { BriefingResult } from '../briefing';
import type { DailyNewsSettings } from '../types';

export abstract class BaseNewsProvider {
    protected settings: DailyNewsSettings;

    constructor(settings: DailyNewsSettings) {
        this.settings = settings;
    }

    /**
     * Fetch and summarize news for a given topic
     */
    abstract fetchAndSummarizeNews(topic: string): Promise<BriefingResult>;

    /**
     * Get the provider name for logging/debugging
     */
    abstract getProviderName(): string;
}