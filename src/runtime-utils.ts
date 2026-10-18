import type { DailyNewsSettings } from './types';
import { GPT_MODEL_NAME, GROK_MODEL_NAME, CLAUDE_MODEL_NAME, OPENROUTER_DEFAULT_MODEL } from './constants';

/** Upgrade recognized previous defaults once; keep other custom model IDs. */
export function migrateModelDefaults(s: DailyNewsSettings, savedVersion?: number): boolean {
    if (savedVersion === 1) return false;
    const replacements: Array<[keyof DailyNewsSettings, string[], string]> = [
        ['gptModel', ['gpt-5.6-sol'], GPT_MODEL_NAME],
        ['grokModel', ['grok-4.5'], GROK_MODEL_NAME],
        ['claudeModel', ['claude-sonnet-5'], CLAUDE_MODEL_NAME],
        ['openrouterModel', ['anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-4.6'], OPENROUTER_DEFAULT_MODEL],
        ['geminiModel', ['gemini-2.5-flash'], ''],
    ];
    for (const [key, previous, next] of replacements) {
        if (previous.includes(s[key] as string)) (s[key] as string) = next;
    }
    s.modelDefaultsVersion = 1;
    return true;
}

/** Calendar date in the same timezone used by the scheduler and note metadata. */
export function localDate(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function scheduleIsDue(time: string, now = new Date()): boolean {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
    const [hours, minutes] = time.split(':').map(Number);
    return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

/** Deliberately excludes credentials, cache contents and display/scheduling settings. */
export function topicCacheKey(date: string, provider: string, topic: string, s: DailyNewsSettings): string {
    const contentSettings = [
        s.includeUndatedNews, s.maxOutputTokens, s.maxSearchCalls, s.geminiModel, s.gptModel, s.claudeModel, s.grokModel, s.perplexityModel, s.openrouterModel,
        s.language, s.outputFormat, s.enableAnalysisContext, s.briefingPreset,
        s.useCustomPrompt, s.customPrompt, s.dateRange, s.resultsPerTopic, s.maxSearchResults,
        s.minContentLength, s.strictQualityFiltering, s.qualityThreshold, s.useAIForQueries,
        s.useAIJudge, s.aiJudgePrompt, s.rssFeeds, s.googleSearchEngineId,
    ];
    // Store the complete configuration to avoid collisions, without storing API keys.
    return `${date}_${provider}_v3_${JSON.stringify([topic, contentSettings])}`;
}
