import type { DailyNewsSettings } from '../../types';
import { AgenticNewsProvider } from '../agentic-news-provider';

export class GrokAgenticProvider extends AgenticNewsProvider {
    constructor(settings: DailyNewsSettings) { super(settings, 'grok'); }
}
