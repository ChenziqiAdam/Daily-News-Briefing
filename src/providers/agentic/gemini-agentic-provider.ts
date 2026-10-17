import type { DailyNewsSettings } from '../../types';
import { AgenticNewsProvider } from '../agentic-news-provider';

export class GeminiAgenticProvider extends AgenticNewsProvider {
    constructor(settings: DailyNewsSettings) { super(settings, 'gemini'); }
}
