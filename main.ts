import { Plugin, Notice } from 'obsidian';
import type { DailyNewsSettings, TopicStatus, TopicContent } from './src/types';
import { DEFAULT_SETTINGS } from './src/types';
import { DailyNewsSettingTab } from './src/settings-tab';
import { NewsProviderFactory } from './src/providers/news-provider-factory';
import { FileUtils, ContentUtils } from './src/utils';
import { buildTemplateData } from './src/template/template-data';
import { SECRET_FIELDS } from './src/constants';
import { STRINGS, strings } from './src/i18n';
import { TemplateEngine } from './src/template/template-engine';
import { SearchSummarizeCoordinator } from './src/providers/coordinators/search-summarize-coordinator';
import { renderBriefing, parseBriefing, failure } from './src/briefing';
import type { BriefingResult } from './src/briefing';
import { localDate, scheduleIsDue, topicCacheKey, mapLimit, errorMessage } from './src/runtime-utils';
import { migrateSettings } from './src/settings-migration';
import { reorganizeExistingNotes, deleteOldNewsNotes } from './src/note-manager';

const SCHEDULE_MAX_ATTEMPTS = 3;
const SCHEDULE_RETRY_MS = 15 * 60 * 1000;
// Small enough to stay inside free-tier rate limits.
const TOPIC_CONCURRENCY = 3;

export default class DailyNewsPlugin extends Plugin {
    settings!: DailyNewsSettings;
    private generationPromise: Promise<string | null> | null = null;
    private scheduled = { date: '', attempts: 0, nextAt: 0 };

    /** Returns a copy of settings with secret IDs resolved to actual key values. */
    resolveSecrets(): DailyNewsSettings {
        const s = this.app.secretStorage;
        const resolve = (val: string) => {
            if (!val) return '';
            const secret = s.getSecret(val);
            if (secret !== null) return secret;
            // A missing registered secret is not a raw API key.
            return SECRET_FIELDS.some(field => field.secretId === val) ? '' : val;
        };
        return {
            ...this.settings,
            googleSearchApiKey: resolve(this.settings.googleSearchApiKey),
            geminiApiKey: resolve(this.settings.geminiApiKey),
            perplexityApiKey: resolve(this.settings.perplexityApiKey),
            openaiApiKey: resolve(this.settings.openaiApiKey),
            grokApiKey: resolve(this.settings.grokApiKey),
            anthropicApiKey: resolve(this.settings.anthropicApiKey),
            openrouterApiKey: resolve(this.settings.openrouterApiKey),
        };
    }

    /**
     * Migrates raw API key values stored in data.json into SecretStorage.
     * Only migrates values that look like raw keys (not already a secret label).
     * Returns the number of keys migrated.
     */
    async migrateRawApiKeys(): Promise<number> {
        const s = this.app.secretStorage;
        let count = 0;
        for (const { key, secretId } of SECRET_FIELDS) {
            const value = this.settings[key] as string;
            if (!value) continue;
            // Skip if already a known secret ID or resolvable as a secret label
            if (value === secretId || s.getSecret(value) !== null) continue;
            // Skip if value looks like a secret label (lowercase alphanumeric + dashes)
            if (/^[a-z0-9-]+$/.test(value)) continue;
            await s.setSecret(secretId, value);
            (this.settings[key] as string) = secretId;
            count++;
        }
        if (count > 0) {
            await this.saveSettings();
        }
        return count;
    }

    async onload() {
        await this.loadSettings();

        // Clean up old cache entries on startup
        await this.cleanupOldCache();

        // Auto-delete old news notes on startup if enabled
        if (this.settings.autoDeleteEnabled) {
            await this.deleteOldNewsNotes();
        }

        // Add settings tab
        this.addSettingTab(new DailyNewsSettingTab(this.app, this));

        // Add sidebar button
        this.addRibbonIcon('newspaper', 'Daily News Briefing', async () => {
            await this.openOrCreateDailyNews();
        });

        // Schedule daily news generation
        this.registerInterval(
            window.setInterval(() => { void this.checkAndGenerateNews(); }, 60000)
        );
        this.app.workspace.onLayoutReady(() => { void this.checkAndGenerateNews(); });

        // Add manual trigger command
        this.addCommand({
            id: 'generate-news-now',
            name: 'Generate news now',
            callback: async () => {
                new Notice('Generating news...');
                await this.generateDailyNews();
            }
        });

        this.addCommand({
            id: 'retry-news-generation',
            name: 'Retry news generation (save a new note)',
            callback: async () => { await this.generateDailyNews(true); }
        });

        this.addCommand({
            id: 'delete-old-news-notes',
            name: 'Delete old news notes',
            callback: async () => {
                await this.deleteOldNewsNotes();
            }
        });
    }

    async loadSettings() {
        const loadedData = await this.loadData();
        this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), loadedData);
        await this.loadTopicCache(loadedData?.dailyTopicCache);

        if (migrateSettings(this.settings, loadedData)) await this.saveSettings();
    }

    async saveSettings() {
        // The topic cache is large and device-specific; it lives in cache.json, not data.json.
        const persisted: Partial<DailyNewsSettings> = { ...this.settings };
        delete persisted.dailyTopicCache;
        await this.saveData(persisted);
    }

    private get topicCachePath(): string {
        const dir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
        return `${dir}/cache.json`;
    }

    async saveTopicCache() {
        try {
            await this.app.vault.adapter.write(this.topicCachePath, JSON.stringify(this.settings.dailyTopicCache));
        } catch (error) {
            console.error('Failed to save the daily topic cache:', error);
        }
    }

    /** Loads cache.json; a cache still stored in data.json by older versions is moved over once. */
    private async loadTopicCache(legacyCache: unknown) {
        try {
            if (await this.app.vault.adapter.exists(this.topicCachePath)) {
                const cache: unknown = JSON.parse(await this.app.vault.adapter.read(this.topicCachePath));
                this.settings.dailyTopicCache = cache && typeof cache === 'object' && !Array.isArray(cache)
                    ? cache as DailyNewsSettings['dailyTopicCache'] : {};
            }
        } catch (error) {
            console.error('Ignoring unreadable daily topic cache:', error);
            this.settings.dailyTopicCache = {};
        }
        if (legacyCache !== undefined) {
            await this.saveTopicCache();
            await this.saveSettings();
        }
    }

    private dailyNotePath(date: string): string {
        return FileUtils.normalizePath(`${this.settings.archiveFolder}/${date.substring(0, 7)}/Daily News - ${date}.md`);
    }

    private async cleanupOldCache() {
        const today = localDate();
        const cacheKeys = Object.keys(this.settings.dailyTopicCache);
        let cleaned = 0;

        for (const key of cacheKeys) {
            // Remove entries that don't start with today's date
            if (!key.startsWith(today + '_')) {
                delete this.settings.dailyTopicCache[key];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            await this.saveTopicCache();
            console.log(`Cleaned ${cleaned} old cache entries from previous days`);
        }
    }

    async checkAndGenerateNews() {
        if (!this.settings.autoGenerateEnabled) return;
        if (this.generationPromise) return;
        const now = new Date();
        const today = localDate(now);
        if (!scheduleIsDue(this.settings.scheduleTime, now)) return;
        if (this.scheduled.date !== today) this.scheduled = { date: today, attempts: 0, nextAt: 0 };
        if (this.scheduled.attempts >= SCHEDULE_MAX_ATTEMPTS || now.getTime() < this.scheduled.nextAt) return;
        // Already generated (e.g. on restart): stay silent instead of showing notices.
        if (await this.app.vault.adapter.exists(this.dailyNotePath(today))) {
            this.scheduled.attempts = SCHEDULE_MAX_ATTEMPTS;
            return;
        }
        // A missing configuration cannot be fixed by retrying; report it once per day.
        if (!NewsProviderFactory.validateProviderConfig(this.resolveSecrets())) this.scheduled.attempts = SCHEDULE_MAX_ATTEMPTS;
        else this.scheduled.attempts++;
        this.scheduled.nextAt = now.getTime() + SCHEDULE_RETRY_MS;
        // Until the last attempt, a run where every topic fails is retried later instead of saved.
        await this.generateDailyNews(false, this.scheduled.attempts < SCHEDULE_MAX_ATTEMPTS);
    }

    async generateDailyNews(retry = false, deferOnTotalFailure = false) {
        if (this.generationPromise) return this.generationPromise;
        this.generationPromise = this.generateDailyNewsInternal(retry, deferOnTotalFailure);
        try {
            return await this.generationPromise;
        } finally {
            this.generationPromise = null;
        }
    }

    private async generateDailyNewsInternal(retry = false, deferOnTotalFailure = false): Promise<string | null> {
        // Validate API configuration first
        const resolvedSettings = this.resolveSecrets();
        if (!NewsProviderFactory.validateProviderConfig(resolvedSettings)) {
            new Notice(`Missing API configuration for ${NewsProviderFactory.getProviderName(this.settings)}. Please check settings.`, 5000);
            return null;
        }

        // Language Validation - modified to handle missing translations
        if (this.settings.language.length !== 2) {
            new Notice("Invalid language code. Please enter a valid ISO 639-1 code (e.g., 'en', 'fr').", 5000);
            return null;
        }
        
        // If language doesn't have translations, warn but continue with English
        if (!Object.prototype.hasOwnProperty.call(STRINGS, this.settings.language)) {
            console.warn(`No translations available for language code "${this.settings.language}". Using English as fallback for UI elements.`);
            new Notice(`No translations available for "${this.settings.language}". UI will show in English, but content will be in the selected language.`, 4000);
        }

        // Warn if AI query feature is enabled but Gemini key is missing (only applies to modular + Google Search)
        if (this.settings.pipelineMode === 'modular' && this.settings.newsSource === 'google'
            && this.settings.useAIForQueries && !this.settings.geminiApiKey) {
            new Notice('AI search queries are enabled but no Gemini API key is set — feature will be skipped. Add your key in Settings.', 6000);
        }

        const date = localDate();
        const processingStartTime = Date.now();
        let progress: Notice | undefined;
        // Built per run so API keys changed in secret storage are always current.
        const newsProvider = NewsProviderFactory.createProvider(resolvedSettings, async () => await this.saveSettings());
        const deferNotice = () => {
            if (this.settings.enableNotifications) new Notice(`Daily news: all topics failed. Retrying in ${SCHEDULE_RETRY_MS / 60000} minutes.`, 6000);
        };

        try {
            // Normalize the path
            const archiveFolder = FileUtils.normalizePath(this.settings.archiveFolder);

            // Extract year and month from date (YYYY-MM-DD format)
            const yearMonth = date.substring(0, 7); // Get YYYY-MM
            const monthlyFolder = `${archiveFolder}/${yearMonth}`;
            const fileName = `${monthlyFolder}/Daily News - ${date}${retry ? ` - Retry ${Date.now()}` : ''}.md`;

            // Check if the file already exists
            if (await this.app.vault.adapter.exists(fileName)) {
                new Notice('Daily news already generated for today.', 5000);
                return fileName;
            }

            // One updating notice instead of one per topic; honours the notifications setting.
            const total = this.settings.topics.length;
            let finished = 0;
            if (this.settings.enableNotifications) progress = new Notice(`Generating daily news... 0/${total} topics`, 0);
            const topicDone = () => progress?.setMessage(`Generating daily news... ${++finished}/${total} topics`);

            const topicStatuses: TopicStatus[] = [];
            const topicContents: TopicContent[] = [];

            // Process topics with bounded concurrency; results keep the configured order.
            const processed = await mapLimit(this.settings.topics, TOPIC_CONCURRENCY, async (topic): Promise<TopicContent> => {
                // Create per-topic cache key
                const cacheKey = topicCacheKey(date, NewsProviderFactory.getProviderKey(this.settings), topic, this.settings);

                // Revalidate cached dates against the moving window before reusing content.
                if (this.settings.dailyTopicCacheEnabled) {
                    const cached = this.settings.dailyTopicCache[cacheKey];
                    if (cached?.result?.status === 'success') {
                        try {
                            const refreshed = parseBriefing(JSON.stringify({ items: cached.result.items }), cached.result.sources, this.settings, cached.result.usage);
                            if (refreshed.status === 'success' && refreshed.items.length === cached.result.items.length) {
                                cached.result = refreshed;
                                cached.content = renderBriefing(refreshed, this.settings);
                                topicDone();
                                return cached;
                            }
                        } catch {
                            // An invalid persisted cache should trigger a fresh fetch, not fail the day.
                        }
                        delete this.settings.dailyTopicCache[cacheKey];
                    }
                }

                const topicStatus: TopicStatus = {
                    topic: topic,
                    retrievalSuccess: false,
                    summarizationSuccess: false,
                    newsCount: 0
                };

                let topicContent = '';
                let briefingResult: BriefingResult | undefined;

                try {
                    try {
                        // Use the news provider to fetch and summarize news
                        briefingResult = await newsProvider.fetchAndSummarizeNews(topic);
                        topicContent = renderBriefing(briefingResult, this.settings);
                        topicStatus.outcome = briefingResult.status;
                        if (briefingResult.status === 'error') {
                            topicStatus.error = briefingResult.error.message;
                        } else {
                            topicStatus.retrievalSuccess = true;
                            topicStatus.summarizationSuccess = true;
                            topicStatus.newsCount = briefingResult.items.length;
                        }
                    } catch (providerError) {
                        console.error(`${newsProvider.getProviderName()} error for ${topic}:`, providerError);
                        briefingResult = failure(providerError);
                        topicStatus.outcome = 'error';
                        topicStatus.error = briefingResult.status === 'error' ? briefingResult.error.message : 'Provider failed';
                        topicContent = renderBriefing(briefingResult, this.settings);
                    }

                } catch (topicError) {
                    console.error(`Unexpected error processing topic ${topic}:`, topicError);
                    topicStatus.outcome = 'error';
                    topicStatus.error = `Unexpected error: ${errorMessage(topicError)}`;
                    topicContent = `${strings(this.settings.language).errorRetrieving} ${topic}. Please try again later.\n\n`;
                }

                const topicContentObj: TopicContent = {
                    topic: topic,
                    content: topicContent,
                    status: topicStatus,
                    result: briefingResult
                };

                // Cache this topic's content only if successful (no errors) and content is non-empty
                if (this.settings.dailyTopicCacheEnabled && briefingResult?.status === 'success' && !briefingResult.warnings.includes('partial_feeds')) {
                    this.settings.dailyTopicCache[cacheKey] = topicContentObj;
                }
                topicDone();
                return topicContentObj;
            });
            progress?.hide();
            for (const topicContent of processed) {
                topicStatuses.push(topicContent.status);
                topicContents.push(topicContent);
            }

            // Feeds are downloaded once per run, so report partial failures once.
            if (newsProvider instanceof SearchSummarizeCoordinator) {
                const failedFeeds = newsProvider.getLastFailedFeeds();
                if (failedFeeds.length > 0) {
                    new Notice(`Some RSS feeds failed to load:\n${failedFeeds.join('\n')}`, 7000);
                }
            }

            if (deferOnTotalFailure && topicStatuses.length > 0 && topicStatuses.every(status => status.outcome === 'error')) {
                console.warn('Daily news: all topics failed; no note saved, the scheduler will retry.');
                deferNotice();
                return null;
            }

            // Analyze results
            const analysis = ContentUtils.analyzeTopicResults(topicStatuses);

            // Log warning if all topics failed, but still create the note
            if (analysis.allTopicsFailed || !analysis.atLeastOneSuccessfulTopic) {
                const errorMessage = analysis.atLeastOneNewsItem
                    ? 'News was retrieved for some topics, but summarization failed for all of them.'
                    : 'Failed to retrieve news for any topics.';
                console.warn(`${errorMessage} Creating note with error information.\nError details:\n${analysis.errorSummary}`);
            }

            // Create folders if they don't exist
            try {
                if (!(await this.app.vault.adapter.exists(archiveFolder))) {
                    await this.app.vault.createFolder(archiveFolder);
                }
                if (!(await this.app.vault.adapter.exists(monthlyFolder))) {
                    await this.app.vault.createFolder(monthlyFolder);
                }
            } catch (folderError) {
                console.error("Failed to create folder:", folderError);
                new Notice('Failed to create archive folder. Cannot create note.', 5000);
                return null;
            }

            const templateData = buildTemplateData(this.settings, date, topicContents, topicStatuses, processingStartTime);

            // Load template file if using file type
            let templateFileContent: string | undefined;
            if (this.settings.templateType === 'file' && this.settings.templateFilePath) {
                templateFileContent = await TemplateEngine.loadTemplateFile(this.app, this.settings.templateFilePath) || undefined;
                if (!templateFileContent) {
                    new Notice(`Failed to load template file: ${this.settings.templateFilePath}. Using default template.`, 5000);
                }
            }

            // Render template
            const content = TemplateEngine.renderTemplate(
                this.settings.templateType,
                this.settings.customTemplate,
                templateData,
                templateFileContent
            );

            // Always attempt to create the note with content (even if it contains errors)
            try {
                await this.app.vault.create(fileName, content);

                // Clean up old cache entries (keep only today's caches)
                const cacheKeys = Object.keys(this.settings.dailyTopicCache);
                for (const key of cacheKeys) {
                    // Remove entries that don't start with today's date
                    if (!key.startsWith(date + '_')) {
                        delete this.settings.dailyTopicCache[key];
                    }
                }

                await this.saveTopicCache();

                if (this.settings.enableNotifications) {
                    const successCount = topicStatuses.filter(s => s.outcome === 'success').length;
                    const emptyCount = topicStatuses.filter(s => s.outcome === 'empty').length;
                    const totalCount = topicStatuses.length;
                    if (analysis.allTopicsFailed || !analysis.atLeastOneSuccessfulTopic) {
                        new Notice(`Daily news: all ${totalCount} topics failed. Check the note for details.`, 6000);
                    } else if (emptyCount === totalCount) {
                        new Notice('No source-backed news found in the selected time window.', 5000);
                    } else if (successCount < totalCount) {
                        new Notice(`Daily news generated: ${successCount}/${totalCount} topics succeeded.`, 5000);
                    } else {
                        new Notice(`Daily news generated: all ${totalCount} topics succeeded.`, 3000);
                    }
                }

                return fileName;
            } catch (createError) {
                console.error('Failed to create note file:', createError);
                new Notice(`Failed to create note file: ${errorMessage(createError)}`, 7000);
                return null;
            }

        } catch (error) {
            console.error('Failed to generate news:', error);
            progress?.hide();
            if (deferOnTotalFailure) {
                deferNotice();
                return null;
            }

            // Last resort: try to create a note with the error message
            try {
                const archiveFolder = FileUtils.normalizePath(this.settings.archiveFolder);
                const yearMonth = date.substring(0, 7); // Get YYYY-MM
                const monthlyFolder = `${archiveFolder}/${yearMonth}`;
                const fileName = `${monthlyFolder}/Daily News - ${date}${retry ? ` - Retry ${Date.now()}` : ''}.md`;
                const errorContent = `# Daily News - ${date}\n\n**Error generating news**\n\nAn unexpected error occurred:\n\n\`\`\`\n${errorMessage(error)}\n\`\`\`\n\nPlease check the console for more details.`;

                // Ensure monthly folder exists
                if (!(await this.app.vault.adapter.exists(archiveFolder))) {
                    await this.app.vault.createFolder(archiveFolder);
                }
                if (!(await this.app.vault.adapter.exists(monthlyFolder))) {
                    await this.app.vault.createFolder(monthlyFolder);
                }

                await this.app.vault.create(fileName, errorContent);
                new Notice('Failed to generate news. Error note created.', 5000);
                return fileName;
            } catch (fallbackError) {
                console.error('Failed to create error note:', fallbackError);
                new Notice('Failed to generate news. Could not create error note.', 5000);
                return null;
            }
        }
    }

    async openOrCreateDailyNews() {
        const date = localDate();
        const filePath = this.dailyNotePath(date);

        try {
            // Check if file exists
            const fileExists = await this.app.vault.adapter.exists(filePath);

            if (fileExists) {
                await FileUtils.openNewsFile(this.app, filePath);
            } else {
                new Notice('Generating today\'s news briefing...');
                const createdPath = await this.generateDailyNews();

                if (createdPath) {
                    activeWindow.setTimeout(async () => {
                        await FileUtils.openNewsFile(this.app, createdPath);
                    }, 1000);
                } else {
                    new Notice('Failed to generate news briefing. No note was created.', 5000);
                }
            }
        } catch (error) {
            console.error('Error opening or creating daily news:', error);
            new Notice(`Unable to open or create daily news: ${errorMessage(error)}`, 6000);
        }
    }

    async reorganizeExistingNotes() {
        await reorganizeExistingNotes(this.app, this.settings);
    }

    async deleteOldNewsNotes() {
        await deleteOldNewsNotes(this.app, this.settings);
    }
}
