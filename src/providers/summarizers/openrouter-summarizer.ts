import type { DailyNewsSettings } from '../../types';
import { StructuredSummarizer } from '../structured-summarizer';

export class OpenRouterSummarizer extends StructuredSummarizer {
    constructor(settings: DailyNewsSettings) { super(settings, 'openrouter'); }
}
