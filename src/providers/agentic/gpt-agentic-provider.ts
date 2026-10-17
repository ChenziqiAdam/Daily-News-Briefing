import type { DailyNewsSettings } from '../../types';
import { AgenticNewsProvider } from '../agentic-news-provider';

export class GptAgenticProvider extends AgenticNewsProvider {
    constructor(settings: DailyNewsSettings) { super(settings, 'gpt'); }
}
