import type { DailyNewsSettings } from '../../types';
import { AgenticNewsProvider } from '../agentic-news-provider';

export class OpenRouterAgenticProvider extends AgenticNewsProvider {
    constructor(settings: DailyNewsSettings) { super(settings, 'openrouter'); }
}
