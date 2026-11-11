import type { DailyNewsSettings } from './types';
import { migrateModelDefaults } from './runtime-utils';

/** Settings that older versions stored and current versions no longer read. */
const REMOVED_KEYS = ['includeDate', 'includeTime', 'minContentLength', 'strictQualityFiltering', 'qualityThreshold'];

/**
 * Upgrades settings loaded from data.json in place.
 * `loaded` is the raw saved object (null on first run); returns true when something changed and must be saved.
 */
export function migrateSettings(settings: DailyNewsSettings, loaded: Record<string, unknown> | null | undefined): boolean {
    if (!loaded) return false;
    let changed = false;

    // Single-field apiProvider -> pipelineMode / newsSource / summarizer / agenticProvider
    if (typeof loaded.apiProvider === 'string' && loaded.apiProvider && !loaded.pipelineMode) {
        const old = loaded.apiProvider;
        if (['sonar', 'gpt', 'grok', 'claude', 'openrouter'].includes(old)) {
            settings.pipelineMode = 'agentic';
            settings.agenticProvider = old as DailyNewsSettings['agenticProvider'];
        } else {
            settings.pipelineMode = 'modular';
            settings.newsSource = old.startsWith('rss') ? 'rss' : 'google';
            const summarizer = old.split('-').pop() ?? '';
            // The oldest value was plain 'google', which names no summarizer.
            settings.summarizer = ['gemini', 'gpt', 'grok', 'claude', 'openrouter'].includes(summarizer)
                ? summarizer as DailyNewsSettings['summarizer'] : 'gemini';
        }
        changed = true;
    }

    // Very old 'google' value
    if ((settings.apiProvider as string) === 'google') {
        settings.apiProvider = 'google-gemini';
        changed = true;
    }

    if (migrateModelDefaults(settings, loaded.modelDefaultsVersion as number | undefined)) changed = true;

    // v1.11 includeDate / includeTime -> includeDatetime
    if (loaded.includeDate || loaded.includeTime) settings.includeDatetime = true;

    // Drop obsolete keys so migrations run once instead of on every start.
    const stored = settings as unknown as Record<string, unknown>;
    for (const key of REMOVED_KEYS) {
        if (key in stored) {
            delete stored[key];
            changed = true;
        }
    }
    return changed;
}
