import type { DailyNewsSettings } from '../../types';
import { StructuredSummarizer } from '../structured-summarizer';

export class GptSummarizer extends StructuredSummarizer {
    constructor(settings: DailyNewsSettings) { super(settings, 'gpt'); }
}
