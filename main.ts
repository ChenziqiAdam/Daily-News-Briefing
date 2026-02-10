import { App, Plugin, Notice, TFile } from 'obsidian';
import type { DailyNewsSettings, TopicStatus, TemplateData, TopicContent } from './src/types';
import { DEFAULT_SETTINGS } from './src/types';
import { DailyNewsSettingTab } from './src/settings-tab';
import { NewsProviderFactory } from './src/providers/news-provider-factory';
import type { BaseNewsProvider } from './src/providers/base-news-provider';
import { FileUtils, LanguageUtils, ContentUtils, MetadataUtils } from './src/utils';
import { LANGUAGE_TRANSLATIONS } from './src/constants';
import { TemplateEngine } from './src/template/template-engine';

export default class DailyNewsPlugin extends Plugin {
    settings: DailyNewsSettings;
    private newsProvider: BaseNewsProvider;

    async onload() {
        await this.loadSettings();
        
        // Initialize news provider
        this.initializeNewsProvider();
        
        // Add settings tab
        this.addSettingTab(new DailyNewsSettingTab(this.app, this));

        // Add sidebar button
        this.addRibbonIcon('newspaper', 'Daily News Briefing', async () => {
            await this.openOrCreateDailyNews();
        });

        // Schedule daily news generation
        this.registerInterval(
            window.setInterval(() => this.checkAndGenerateNews(), 60000)
        );

        // Add manual trigger command
        this.addCommand({
            id: 'generate-news-now',
            name: 'Generate news now',
            callback: async () => {
                new Notice('Generating news...');
                await this.generateDailyNews();
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Migration logic for old provider values
        const oldProvider = this.settings.apiProvider as any;
        if (oldProvider === 'google') {
            this.settings.apiProvider = 'google-gemini' ;
            await this. saveData(this. settings); // Save the migrated settings
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Update news provider when settings change
        this.initializeNewsProvider();
    }

    private initializeNewsProvider() {
        this.newsProvider = NewsProviderFactory.createProvider(
            this.settings,
            async () => await this.saveSettings()
        );
    }

    private buildTopicsSections(topicContents: TopicContent[]): string {
        let sections = '';
        for (const topicContent of topicContents) {
            sections += `\n---\n\n`;
            sections += `## ${topicContent.topic}\n\n`;
            sections += topicContent.content;
        }
        return sections;
    }

    async checkAndGenerateNews() {
        const now = new Date();
        const scheduledTime = this.settings.scheduleTime.split(':');
        const targetHour = parseInt(scheduledTime[0]);
        const targetMinute = parseInt(scheduledTime[1]);

        if (now.getHours() === targetHour && now.getMinutes() === targetMinute) {
            await this.generateDailyNews();
        }
    }

    async generateDailyNews() {
        // Validate API configuration first
        if (!NewsProviderFactory.validateProviderConfig(this.settings)) {
            new Notice(`Missing API configuration for ${NewsProviderFactory.getProviderName(this.settings)}. Please check settings.`, 5000);
            return null;
        }

        // Language Validation - modified to handle missing translations
        if (this.settings.language.length !== 2) {
            new Notice("Invalid language code. Please enter a valid ISO 639-1 code (e.g., 'en', 'fr').", 5000);
            return null;
        }
        
        // If language doesn't have translations, warn but continue with English
        if (!LANGUAGE_TRANSLATIONS[this.settings.language]) {
            console.warn(`No translations available for language code "${this.settings.language}". Using English as fallback for UI elements.`);
            new Notice(`No translations available for "${this.settings.language}". UI will show in English, but content will be in the selected language.`, 4000);
        }

        const date = new Date().toISOString().split('T')[0];
        const processingStartTime = Date.now();

        try {
            new Notice('Generating daily news...');

            // Normalize the path
            const archiveFolder = FileUtils.normalizePath(this.settings.archiveFolder);
            const fileName = `${archiveFolder}/Daily News - ${date}.md`;

            // Check if the file already exists
            if (await this.app.vault.adapter.exists(fileName)) {
                new Notice('Daily news already generated for today.', 5000);
                return fileName;
            }

            const topicStatuses: TopicStatus[] = [];
            const topicContents: TopicContent[] = [];

            // Process each topic
            for (const topic of this.settings.topics) {
                // Create per-topic cache key
                const topicCacheKey = `${date}_${this.settings.apiProvider}_${topic}`;

                // Check if this topic is already cached
                if (this.settings.dailyTopicCache[topicCacheKey]) {
                    new Notice(`Using cached content for ${topic}...`);
                    const cachedTopicContent = this.settings.dailyTopicCache[topicCacheKey];
                    topicStatuses.push(cachedTopicContent.status);
                    topicContents.push(cachedTopicContent);
                    continue;
                }

                const topicStatus: TopicStatus = {
                    topic: topic,
                    retrievalSuccess: false,
                    summarizationSuccess: false,
                    newsCount: 0
                };

                let topicContent = '';

                try {
                    new Notice(`Fetching news for ${topic}...`);

                    try {
                        // Use the news provider to fetch and summarize news
                        const summary = await this.newsProvider.fetchAndSummarizeNews(topic);

                        // Check if summary contains error messages
                        if (summary.includes('Error') || summary.includes('error')) {
                            topicStatus.error = `${this.newsProvider.getProviderName()} error for topic "${topic}"`;
                            topicContent = `**Error processing ${topic} with ${this.newsProvider.getProviderName()}.**\n\n${summary}\n`;
                        } else if (summary.includes(LanguageUtils.getTranslation('noRecentNews', this.settings.language)) ||
                                   summary.includes('No recent news found')) {
                            topicStatus.error = `No news found for topic "${topic}"`;
                            topicContent = `${summary}\n\n`;
                        } else {
                            // Success case
                            topicStatus.retrievalSuccess = true;
                            topicStatus.summarizationSuccess = true;
                            topicStatus.newsCount = 1; // We don't have granular info from unified interface
                            topicContent = summary + '\n';
                        }
                    } catch (providerError) {
                        console.error(`${this.newsProvider.getProviderName()} error for ${topic}:`, providerError);
                        topicStatus.error = `Provider error: ${providerError.message}`;
                        topicContent = `**${LanguageUtils.getTranslation('errorRetrieving', this.settings.language)} ${topic} using ${this.newsProvider.getProviderName()}.**\n\nError details: ${providerError.message}\n\n`;
                    }

                } catch (topicError) {
                    console.error(`Unexpected error processing topic ${topic}:`, topicError);
                    topicStatus.error = `Unexpected error: ${topicError.message}`;
                    topicContent = `${LanguageUtils.getTranslation('errorRetrieving', this.settings.language)} ${topic}. Please try again later.\n\n`;
                }

                const topicContentObj: TopicContent = {
                    topic: topic,
                    content: topicContent,
                    status: topicStatus
                };

                topicStatuses.push(topicStatus);
                topicContents.push(topicContentObj);

                // Cache this topic's content
                this.settings.dailyTopicCache[topicCacheKey] = topicContentObj;
            }

            // Analyze results
            const analysis = ContentUtils.analyzeTopicResults(topicStatuses);

            // Log warning if all topics failed, but still create the note
            if (analysis.allTopicsFailed || !analysis.atLeastOneSuccessfulTopic) {
                const errorMessage = analysis.atLeastOneNewsItem
                    ? 'News was retrieved for some topics, but summarization failed for all of them.'
                    : 'Failed to retrieve news for any topics.';

                console.warn(`${errorMessage} Creating note with error information.\nError details:\n${analysis.errorSummary}`);

                if (this.settings.enableNotifications) {
                    new Notice(`${errorMessage} Creating note with error details.`, 5000);
                }
            }

            // Create folder if it doesn't exist
            try {
                if (!(await this.app.vault.adapter.exists(archiveFolder))) {
                    await this.app.vault.createFolder(archiveFolder);
                }
            } catch (folderError) {
                console.error("Failed to create folder:", folderError);
                new Notice('Failed to create archive folder. Cannot create note.', 5000);
                return null;
            }

            // Prepare fine-grained date/time data
            const now = new Date();
            const metadata = this.settings.enableMetadata
                ? MetadataUtils.generateMetadata(this.settings, processingStartTime)
                : {};

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            // Prepare template data with all placeholders
            const templateData: TemplateData = {
                // Basic placeholders
                metadata: this.settings.enableMetadata
                    ? MetadataUtils.formatMetadataAsYAML(metadata)
                    : '',
                timestamp: `${LanguageUtils.getTranslation('generatedAt', this.settings.language)} ${now.toLocaleTimeString()}`,
                date: date,
                time: now.toLocaleTimeString('en-US', { hour12: false }),
                tableOfContents: ContentUtils.buildTableOfContents(this.settings.topics),
                topics: this.buildTopicsSections(topicContents),
                topicContents: topicContents,
                processingStatus: topicStatuses.some(status => status.error)
                    ? ContentUtils.buildProcessingStatus(topicStatuses, this.settings.language)
                    : '',
                language: this.settings.language,

                // Fine-grained date/time placeholders
                year: now.getFullYear().toString(),
                month: (now.getMonth() + 1).toString().padStart(2, '0'),
                monthName: monthNames[now.getMonth()],
                monthNameShort: monthNamesShort[now.getMonth()],
                day: now.getDate().toString().padStart(2, '0'),
                dayName: dayNames[now.getDay()],
                dayNameShort: dayNamesShort[now.getDay()],
                hour: now.getHours().toString().padStart(2, '0'),
                minute: now.getMinutes().toString().padStart(2, '0'),
                second: now.getSeconds().toString().padStart(2, '0'),

                // Metadata field placeholders
                metadataDate: metadata.date || '',
                metadataTime: metadata.time || '',
                metadataTags: metadata.tags ? metadata.tags.join(', ') : '',
                metadataLanguage: metadata.language || '',
                metadataProvider: metadata.source || '',

                // Topic info placeholders
                topicCount: this.settings.topics.length.toString(),
                topicList: this.settings.topics.join(', '),

                // Topic sections (for future loop support)
                topicSections: this.buildTopicsSections(topicContents)
            };

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

                // Save settings to persist the cache
                await this.saveSettings();

                if (this.settings.enableNotifications) {
                    if (analysis.allTopicsFailed || !analysis.atLeastOneSuccessfulTopic) {
                        new Notice('Daily news note created with errors. Please check the note.', 4000);
                    } else {
                        new Notice('Daily news generated successfully', 3000);
                    }
                }

                return fileName;
            } catch (createError) {
                console.error('Failed to create note file:', createError);
                new Notice('Failed to create note file. Check console for details.', 5000);
                return null;
            }

        } catch (error) {
            console.error('Failed to generate news:', error);

            // Last resort: try to create a note with the error message
            try {
                const archiveFolder = FileUtils.normalizePath(this.settings.archiveFolder);
                const fileName = `${archiveFolder}/Daily News - ${date}.md`;
                const errorContent = `# Daily News - ${date}\n\n**Error generating news**\n\nAn unexpected error occurred:\n\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease check the console for more details.`;

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
        const date = new Date().toISOString().split('T')[0];
        const filePath = FileUtils.normalizePath(`${this.settings.archiveFolder}/Daily News - ${date}.md`);
        
        try {
            // Check if file exists
            const fileExists = await this.app.vault.adapter.exists(filePath);
            
            if (fileExists) {
                FileUtils.openNewsFile(this.app, filePath);
            } else {
                new Notice('Generating today\'s news briefing...');
                const createdPath = await this.generateDailyNews();
                
                if (createdPath) {
                    setTimeout(() => {
                        FileUtils.openNewsFile(this.app, createdPath);
                    }, 1000);
                } else {
                    new Notice('Failed to generate news briefing. No note was created.', 5000);
                }
            }
        } catch (error) {
            console.error('Error opening or creating daily news:', error);
            new Notice('Unable to open or create daily news');
        }
    }
}