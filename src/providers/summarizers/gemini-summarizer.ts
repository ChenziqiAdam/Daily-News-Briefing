import type { DailyNewsSettings } from '../../types';
import { StructuredSummarizer } from '../structured-summarizer';

export class GeminiSummarizer extends StructuredSummarizer {
    constructor(settings: DailyNewsSettings) { super(settings, 'gemini'); }
}
