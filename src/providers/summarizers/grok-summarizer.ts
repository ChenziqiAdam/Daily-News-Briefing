import type { DailyNewsSettings } from '../../types';
import { StructuredSummarizer } from '../structured-summarizer';

export class GrokSummarizer extends StructuredSummarizer {
    constructor(settings: DailyNewsSettings) { super(settings, 'grok'); }
}
