import type { DailyNewsSettings } from '../../types';
import { StructuredSummarizer } from '../structured-summarizer';

export class ClaudeSummarizer extends StructuredSummarizer {
    constructor(settings: DailyNewsSettings) { super(settings, 'claude'); }
}
