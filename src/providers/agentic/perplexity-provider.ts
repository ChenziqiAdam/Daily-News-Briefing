import type { DailyNewsSettings } from '../../types';
import { AgenticNewsProvider } from '../agentic-news-provider';

export class PerplexityNewsProvider extends AgenticNewsProvider {
    constructor(settings: DailyNewsSettings) { super(settings, 'sonar'); }
}
