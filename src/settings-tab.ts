import { App, PluginSettingTab, Setting, Notice, SecretComponent } from 'obsidian';
import type { BriefingPresetId, DailyNewsSettings } from './types';
import type DailyNewsPlugin from '../main';
import { NewsProviderFactory } from './providers/news-provider-factory';
import {
    BRIEFING_PRESETS,
    GEMINI_MODEL_NAME,
    GEMINI_SUMMARY_MODEL_NAME,
    GPT_MODEL_NAME,
    PERPLEXITY_MODEL_NAME,
    GROK_MODEL_NAME,
    CLAUDE_MODEL_NAME,
    OPENROUTER_DEFAULT_MODEL
} from './constants';
import { TemplateEngine } from './template/template-engine';
import { TEMPLATE_DESCRIPTIONS, TEMPLATE_EXAMPLE, TEMPLATE_FILE_EXAMPLE } from './template/template-presets';
import { StructuredSummarizer } from './providers/structured-summarizer';
import { AgenticNewsProvider } from './providers/agentic-news-provider';
import type { ModelKind } from './providers/native-response';
import { STRINGS } from './i18n';

/** Names of the settings whose value has type T. */
type KeysOf<T> = { [K in keyof DailyNewsSettings]: DailyNewsSettings[K] extends T ? K : never }[keyof DailyNewsSettings];

/** API section shown for the model that writes the briefing. */
const MODEL_SECTIONS: Record<ModelKind, { heading: string; keyDesc: string; key: KeysOf<string>; model: KeysOf<string>; defaultModel: string; placeholder: string }> = {
    gemini: { heading: 'Gemini API', keyDesc: 'Select the Google Gemini API key from Obsidian Secret Storage', key: 'geminiApiKey', model: 'geminiModel', defaultModel: GEMINI_SUMMARY_MODEL_NAME, placeholder: 'Leave blank for the mode-specific default' },
    gpt: { heading: 'OpenAI API', keyDesc: 'Select the OpenAI API key from Obsidian Secret Storage', key: 'openaiApiKey', model: 'gptModel', defaultModel: GPT_MODEL_NAME, placeholder: `e.g. ${GPT_MODEL_NAME}` },
    sonar: { heading: 'Perplexity API', keyDesc: 'Select the Perplexity API key from Obsidian Secret Storage', key: 'perplexityApiKey', model: 'perplexityModel', defaultModel: PERPLEXITY_MODEL_NAME, placeholder: 'e.g. sonar' },
    grok: { heading: 'Grok API', keyDesc: 'Select the Grok API key from Obsidian Secret Storage', key: 'grokApiKey', model: 'grokModel', defaultModel: GROK_MODEL_NAME, placeholder: `e.g. ${GROK_MODEL_NAME}` },
    claude: { heading: 'Anthropic API', keyDesc: 'Select the Anthropic API key from Obsidian Secret Storage', key: 'anthropicApiKey', model: 'claudeModel', defaultModel: CLAUDE_MODEL_NAME, placeholder: `e.g. ${CLAUDE_MODEL_NAME}` },
    openrouter: { heading: 'OpenRouter API', keyDesc: 'Select the OpenRouter API key from Obsidian Secret Storage', key: 'openrouterApiKey', model: 'openrouterModel', defaultModel: OPENROUTER_DEFAULT_MODEL, placeholder: OPENROUTER_DEFAULT_MODEL },
};

export class DailyNewsSettingTab extends PluginSettingTab {
    plugin: DailyNewsPlugin;
    showAdvanced = false;
    showMetadataDetails = false;
    showTemplatePlaceholders = false;

    constructor(app: App, plugin: DailyNewsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private get config(): DailyNewsSettings {
        return this.plugin.settings;
    }

    /** The model that writes the briefing in the selected pipeline. */
    private get modelKind(): ModelKind {
        return this.config.pipelineMode === 'agentic' ? this.config.agenticProvider : this.config.summarizer;
    }

    // ----- Reusable controls: each stores one setting and optionally redraws the tab -----

    private async store<K extends keyof DailyNewsSettings>(key: K, value: DailyNewsSettings[K], refresh = false): Promise<void> {
        this.config[key] = value;
        await this.plugin.saveSettings();
        if (refresh) this.display();
    }

    private addToggle(el: HTMLElement, key: KeysOf<boolean>, name: string, desc: string, refresh = false): Setting {
        return new Setting(el).setName(name).setDesc(desc)
            .addToggle(toggle => toggle.setValue(this.config[key]).onChange(value => this.store(key, value, refresh)));
    }

    private addDropdown<K extends KeysOf<string>>(el: HTMLElement, key: K, name: string, desc: string, options: Record<string, string>, refresh = false): Setting {
        return new Setting(el).setName(name).setDesc(desc)
            .addDropdown(dropdown => dropdown.addOptions(options).setValue(this.config[key] as string)
                .onChange(value => this.store(key, value as DailyNewsSettings[K], refresh)));
    }

    private addSlider(el: HTMLElement, key: KeysOf<number>, name: string, desc: string, min: number, max: number, step: number): Setting {
        return new Setting(el).setName(name).setDesc(desc)
            .addSlider(slider => slider.setLimits(min, max, step).setValue(this.config[key]).setDynamicTooltip()
                .onChange(value => this.store(key, value)));
    }

    private addText<K extends KeysOf<string>>(el: HTMLElement, key: K, name: string, desc: string, placeholder: string, trim = false): Setting {
        return new Setting(el).setName(name).setDesc(desc)
            .addText(text => text.setPlaceholder(placeholder).setValue((this.config[key] as string) || '')
                .onChange(value => this.store(key, (trim ? value.trim() : value) as DailyNewsSettings[K])));
    }

    /** Creates an API key setting backed by Obsidian's SecretStorage selector. */
    private addApiKeySetting<K extends KeysOf<string>>(el: HTMLElement, desc: string, key: K): void {
        new Setting(el).setName('API key').setDesc(desc)
            .addComponent(componentEl => new SecretComponent(this.app, componentEl)
                .setValue((this.config[key] as string) || '')
                .onChange(value => this.store(key, value as DailyNewsSettings[K])));
    }

    private createSection(containerEl: HTMLElement, title: string, description?: string): HTMLElement {
        const section = containerEl.createDiv('settings-section');
        new Setting(section).setName(title).setHeading();
        if (description) {
            section.createEl('p', {text: description, cls: 'settings-section-description'});
        }
        return section;
    }

    private addSubheading(el: HTMLElement, text: string): void {
        el.createDiv({text, cls: 'setting-item-heading'});
    }

    private createCollapsible(containerEl: HTMLElement, title: string, isExpanded: boolean, onToggle: (expanded: boolean) => void): HTMLElement {
        const header = containerEl.createDiv('collapsible-header');
        const icon = header.createSpan({ text: '▶', cls: 'collapsible-icon' });
        if (isExpanded) {
            icon.addClass('expanded');
        }
        header.createSpan({ text: title });

        const content = containerEl.createDiv('collapsible-content');
        if (!isExpanded) {
            content.addClass('is-collapsed');
        }

        header.addEventListener('click', () => {
            isExpanded = !isExpanded;
            icon.toggleClass('expanded', isExpanded);
            content.toggleClass('is-collapsed', !isExpanded);
            onToggle(isExpanded);
        });

        return content;
    }

    // ----- Actions -----

    /** Sends a minimal request to the active AI provider to verify the API key and model are valid. */
    private async testAIConnection(): Promise<{ success: boolean; message: string }> {
        const { pipelineMode, summarizer, agenticProvider } = this.config;
        const s = this.plugin.resolveSecrets();

        return pipelineMode === 'modular'
            ? new StructuredSummarizer(s, summarizer).testConnection()
            : new AgenticNewsProvider(s, agenticProvider).testConnection();
    }

    private async applyBriefingPreset(presetId: BriefingPresetId): Promise<void> {
        if (presetId === 'none') {
            await this.store('briefingPreset', 'none');
            return;
        }

        const preset = BRIEFING_PRESETS[presetId];
        if (!preset) {
            new Notice('Unknown briefing preset.');
            return;
        }

        this.config.briefingPreset = preset.id;
        this.config.topics = [...preset.topics];
        this.config.outputFormat = preset.outputFormat;
        this.config.enableAnalysisContext = preset.enableAnalysisContext;
        this.config.templateType = preset.templateType;

        await this.plugin.saveSettings();
        new Notice(`Applied ${preset.name}. You can edit topics and settings anytime.`, 4000);
        this.display();
    }

    private reportTemplateValidation(template: string, label: string): void {
        const validation = TemplateEngine.validateTemplate(template);
        if (validation.valid) {
            new Notice(`✓ ${label} is valid!`, 3000);
        } else {
            new Notice(`✗ Template errors:\n${validation.errors.join('\n')}`, 5000);
        }
    }

    // ----- Sections -----

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        this.renderPresets(containerEl);
        this.renderPipeline(containerEl);
        this.renderApi(containerEl);
        this.renderNews(containerEl);
        this.renderLimits(containerEl);
        this.renderSchedule(containerEl);
        this.renderMetadata(containerEl);
        this.renderTemplate(containerEl);
        this.renderAdvanced(containerEl);
    }

    private renderPresets(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'Briefing Presets', 'Start from a user goal, then edit topics and settings as needed');

        const currentPreset = this.config.briefingPreset || 'none';
        const preset = currentPreset !== 'none' ? BRIEFING_PRESETS[currentPreset] : undefined;
        const options: Record<string, string> = { none: 'None / Custom' };
        Object.values(BRIEFING_PRESETS).forEach(definition => { options[definition.id] = definition.name; });

        new Setting(section)
            .setName('Preset')
            .setDesc(preset ? preset.description : 'No preset selected. Existing custom settings stay active.')
            .addDropdown(dropdown => dropdown.addOptions(options).setValue(currentPreset)
                .onChange(value => this.store('briefingPreset', value as BriefingPresetId, true)))
            .addButton(button => button
                .setButtonText('Apply preset')
                .setCta()
                .onClick(async () => {
                    await this.applyBriefingPreset(this.config.briefingPreset || 'none');
                }));

        if (preset) {
            section.createEl('p', {
                text: `Apply preset changes: topics (${preset.topics.join(', ')}), output style (${preset.outputFormat}), analysis (${preset.enableAnalysisContext ? 'on' : 'off'}), template (${preset.templateType}), and briefing focus. Preserves API keys, providers, schedule, archive folder, language, RSS feeds, retention, metadata, and cache.`,
                cls: 'settings-section-description'
            });
        }
    }

    private renderPipeline(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'News Pipeline', 'Choose your news retrieval and summarization pipeline');

        this.addDropdown(section, 'pipelineMode', 'Pipeline mode',
            'Modular: pick a news source + AI summarizer independently. Agentic: a single provider handles both search and summarization.',
            { modular: 'Modular (News Source + Summarizer)', agentic: 'Agentic (Unified Provider)' }, true);

        if (this.config.pipelineMode === 'modular') {
            this.addDropdown(section, 'newsSource', 'News source', 'Where to retrieve news articles from',
                { google: 'Google Search (legacy; ends 2027-01-01)', rss: 'RSS Feeds', perplexity: 'Perplexity Search' }, true);
            this.addDropdown(section, 'summarizer', 'AI summarizer', 'AI model used to summarize retrieved articles',
                { gemini: 'Gemini', gpt: 'GPT', grok: 'Grok', claude: 'Claude', openrouter: 'OpenRouter' }, true);
        } else {
            this.addDropdown(section, 'agenticProvider', 'Provider', 'Unified provider that handles both search and summarization',
                { sonar: 'Perplexity', gpt: 'GPT', grok: 'Grok', claude: 'Claude', openrouter: 'OpenRouter', gemini: 'Gemini' }, true);
        }
    }

    private renderApi(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'API Configuration', 'Configure API keys for your selected pipeline');
        const { pipelineMode, newsSource } = this.config;

        new Setting(section)
            .setName('Migrate legacy API keys')
            .setDesc('If you installed this plugin before v1.11.4 and have raw API keys stored in data.json, click to move them into Obsidian SecretStorage.')
            .addButton(btn => btn
                .setButtonText('Migrate')
                .onClick(async () => {
                    const count = await this.plugin.migrateRawApiKeys();
                    if (count > 0) {
                        new Notice(`Migrated ${count} API key(s) into SecretStorage.`);
                        this.display();
                    } else {
                        new Notice('No legacy API keys found to migrate.');
                    }
                }));

        if (pipelineMode === 'modular' && newsSource === 'google') {
            this.addSubheading(section, 'Google Search API (legacy)');
            section.createEl('p', { text: 'Closed to new customers; service ends January 1, 2027. Switch News source to Perplexity Search or RSS, or use an agentic provider. Your existing configuration is preserved.' });
            this.addApiKeySetting(section, 'Select the Google Custom Search API key from Obsidian Secret Storage', 'googleSearchApiKey');
            this.addText(section, 'googleSearchEngineId', 'Search engine ID', 'Your Google Custom Search Engine ID', 'Enter search engine ID');
        }

        if (pipelineMode === 'modular' && newsSource === 'perplexity') {
            this.addSubheading(section, 'Perplexity Search API');
            this.addApiKeySetting(section, 'Select the Perplexity API key from Obsidian Secret Storage', 'perplexityApiKey');
        }

        if (pipelineMode === 'modular' && newsSource === 'rss') {
            this.addSubheading(section, 'RSS Feeds');
            section.createEl('p', {
                text: 'Add RSS feed URLs (one per line). The plugin will fetch news from these feeds and filter by topic.',
                cls: 'setting-item-description'
            });

            new Setting(section)
                .setName('RSS feed URLs')
                .setDesc('Enter RSS feed URLs, one per line')
                .addTextArea(text => {
                    text.setPlaceholder('https://example.com/feed.xml\nhttps://news.example.org/rss')
                        .setValue(this.config.rssFeeds.join('\n'))
                        .onChange(value => this.store('rssFeeds', value.split('\n').map(line => line.trim()).filter(line => line.length > 0)));
                    text.inputEl.rows = 6;
                    text.inputEl.addClass('full-width-input');
                });
        }

        const kind = this.modelKind;
        const model = MODEL_SECTIONS[kind];
        if (model) {
            this.addSubheading(section, model.heading);
            this.addApiKeySetting(section, model.keyDesc, model.key);
            if (kind === 'openrouter') {
                this.addText(section, model.model, 'Model', `Enter the OpenRouter model ID to use (e.g. ${model.defaultModel})`, model.placeholder, true);
            } else {
                const defaultModel = kind === 'gemini' && pipelineMode === 'agentic' ? GEMINI_MODEL_NAME : model.defaultModel;
                this.addText(section, model.model, 'Model', `Enter the model ID to use. Leave blank to use the default (${defaultModel}).`, model.placeholder, true);
            }
            if (kind === 'gemini') {
                section.createEl('p', { text: 'Free API tier: Gemini 3.8 Flash supports text summaries, but Google Search grounding requires billing. The agentic default remains Gemini 2.5 Flash: free Search is limited to eligible existing users and project quotas. New free users: choose RSS + Gemini with the Model field blank. You can enter a newer model for agentic search if billing is enabled. AI Studio chat access does not guarantee API tool access.' });
            }
        }

        new Setting(section)
            .setName('Test connection')
            .setDesc('Verify your key and model. In agentic mode, every provider sends a search request; standard API/search charges and quotas apply.')
            .addButton(btn => btn
                .setButtonText('Test')
                .onClick(async () => {
                    btn.setButtonText('Testing…');
                    btn.setDisabled(true);
                    const result = await this.testAIConnection();
                    btn.setButtonText('Test');
                    btn.setDisabled(false);
                    new Notice(result.success ? `✓ ${result.message}` : `✗ ${result.message}`, 6000);
                }));
    }

    private renderNews(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'News Configuration', 'Configure news topics, language, and output preferences');
        const { pipelineMode, newsSource } = this.config;

        const languages: Record<string, string> = {};
        Object.entries(STRINGS).forEach(([code, text]) => { languages[code] = text.name; });
        this.addDropdown(section, 'language', 'Language', 'Language for news content and UI elements', languages);

        new Setting(section)
            .setName('Topics')
            .setDesc('News topics to follow (comma-separated)')
            .addText(text => text
                .setPlaceholder('Technology, World News, Science')
                .setValue(this.config.topics.join(', '))
                .onChange(value => this.store('topics', value.split(',').map(t => t.trim()).filter(t => t.length > 0))));

        this.addDropdown(section, 'outputFormat', 'Output style', 'Choose level of detail for news summaries',
            { detailed: 'Detailed - with analysis', concise: 'Concise - just facts' });
        this.addToggle(section, 'enableAnalysisContext', 'Enable analysis & context', 'Include analytical section in detailed news summaries');
        this.addSlider(section, 'resultsPerTopic', 'News items per topic', 'Maximum number of news items to include per topic', 3, 15, 1);

        if (pipelineMode === 'modular' && newsSource !== 'rss') {
            this.addSubheading(section, 'Search Settings');
            this.addSlider(section, 'maxSearchResults', 'Maximum search results',
                newsSource === 'google' ? 'Total search results to fetch (higher values give more options but use more API quota)' : 'Total search results to fetch',
                10, 50, 5);
        }

        new Setting(section)
            .setName('News time window')
            .setDesc('Applies to every pipeline. d1 = last 24 hours, d3 = 3 days, w1 = 1 week. Existing settings are preserved.')
            .addText(text => text.setPlaceholder('d1').setValue(this.config.dateRange)
                .onChange(async value => {
                    if (!/^([dw])([1-9]\d{0,2})$/.test(value)) return;
                    await this.store('dateRange', value);
                }));
        this.addToggle(section, 'includeUndatedNews', 'Include news without publication dates',
            'Off by default. Undated items, when enabled, are explicitly marked and freshness cannot be confirmed.');
    }

    private renderLimits(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'Request limits & usage', 'Native search is followed by a structured summary call. Limits apply per request; provider billing remains authoritative.');
        this.addSlider(section, 'maxOutputTokens', 'Maximum output tokens', '', 1024, 16384, 1024);
        this.addSlider(section, 'maxSearchCalls', 'Maximum search calls (where supported)', '', 1, 10, 1);
        this.addSlider(section, 'requestTimeoutSeconds', 'Request timeout (seconds)', '', 30, 300, 30);
        this.addSlider(section, 'requestRetries', 'Retries for throttling/server errors', '', 0, 2, 1);
        section.createEl('p', { text: 'Google grounding and Grok may not honor a hard search-count limit. Retries can incur additional usage. HTTP timeouts stop waiting but cannot cancel Obsidian transport requests. No automatic provider/model fallback is used.' });
        this.addToggle(section, 'showUsage', 'Show reported API usage in notes',
            'Shows returned token/search counts for generation calls. Missing provider counts, retriever calls and failed/retried calls may not be included; this is not a bill estimate.');
    }

    private renderSchedule(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'Scheduling & Storage', 'Configure when and where to generate news, and how long to keep notes');

        this.addToggle(section, 'autoGenerateEnabled', 'Enable auto-generation',
            'Automatically generate news briefing at the scheduled time. Note: This will perform background network calls to your selected AI and news providers.');

        new Setting(section)
            .setName('Schedule time')
            .setDesc('When to generate daily news (24-hour format, e.g., 08:00)')
            .addText(text => text
                .setPlaceholder('HH:MM')
                .setValue(this.config.scheduleTime)
                .onChange(async (value) => {
                    const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
                    if (!isValid) {
                        new Notice('Invalid time format. Please use HH:MM (e.g., 08:00).', 4000);
                        text.setValue(this.config.scheduleTime);
                        return;
                    }
                    await this.store('scheduleTime', value);
                }));

        this.addText(section, 'archiveFolder', 'Archive folder', 'Folder to store daily news notes', 'News Archive');

        new Setting(section)
            .setName('Organize notes into monthly folders')
            .setDesc('Daily news notes are automatically organized into monthly subfolders (YYYY-MM). Click below to reorganize existing notes.')
            .addButton(button => button
                .setButtonText('Reorganize existing notes')
                .setTooltip('Move existing daily news files into monthly subfolders')
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Reorganizing...');
                    await this.plugin.reorganizeExistingNotes();
                    button.setDisabled(false);
                    button.setButtonText('Reorganize existing notes');
                }));

        this.addToggle(section, 'enableNotifications', 'Enable notifications', 'Show progress and result notifications when news is generated');
        this.addToggle(section, 'autoDeleteEnabled', 'Enable auto-delete', 'Automatically delete news notes older than the retention period on plugin startup');
        this.addDropdown(section, 'autoDeleteRetention', 'Retention period',
            'Delete news notes older than this period (applies to both auto-delete and manual deletion)',
            { '1d': '1 day', '3d': '3 days', '1w': '1 week', '2w': '2 weeks', '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year', never: 'Never (disabled)' });

        new Setting(section)
            .setName('Delete old notes now')
            .setDesc('Manually delete notes older than the retention period')
            .addButton(button => button
                .setButtonText('Delete old notes')
                .setTooltip('Delete news notes older than the configured retention period')
                .onClick(async () => {
                    button.setDisabled(true);
                    button.setButtonText('Deleting...');
                    await this.plugin.deleteOldNewsNotes();
                    button.setDisabled(false);
                    button.setButtonText('Delete old notes');
                }));
    }

    private renderMetadata(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'Metadata Configuration', 'Configure YAML frontmatter metadata for generated news files');

        this.addToggle(section, 'enableMetadata', 'Enable metadata', 'Add YAML frontmatter metadata to generated news files', true);
        if (!this.config.enableMetadata) return;

        const content = this.createCollapsible(section, 'Metadata Fields', this.showMetadataDetails,
            (expanded) => { this.showMetadataDetails = expanded; });

        this.addToggle(content, 'includeDatetime', 'Include datetime', 'Add datetime field (YYYY-MM-DD HH:MM:SS)');
        this.addToggle(content, 'includeTopics', 'Include topics', 'Add topics array');
        this.addToggle(content, 'includeTags', 'Include tags', 'Add tags array (auto-generated from topics)');
        this.addToggle(content, 'includeLanguage', 'Include language', 'Add language code');
        this.addToggle(content, 'includeSource', 'Include source', 'Add news source/provider information');
        this.addToggle(content, 'includeProcessingTime', 'Include processing time', 'Add processing duration');
        this.addToggle(content, 'includeOutputFormat', 'Include output format', 'Add output format (detailed/concise)');
    }

    private renderPlaceholderHelp(section: HTMLElement, intro?: string): void {
        const content = this.createCollapsible(section, 'Available Placeholders', this.showTemplatePlaceholders,
            (expanded) => { this.showTemplatePlaceholders = expanded; });

        const infoEl = content.createDiv('template-placeholder-info');
        if (intro) {
            infoEl.createEl('p', { text: intro, cls: 'settings-section-description' });
        }

        TemplateEngine.getPlaceholderInfo().forEach(category => {
            const categoryEl = infoEl.createDiv({cls: 'placeholder-category'});
            categoryEl.createEl('strong', {text: category.category + ':'});
            const placeholderList = categoryEl.createEl('ul');

            category.placeholders.forEach(info => {
                const li = placeholderList.createEl('li');
                li.createEl('code', {text: info.placeholder});
                li.appendText(` - ${info.description}`);
            });
        });
    }

    private renderTemplate(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'Template Configuration', 'Customize the format of your daily news notes');

        this.addDropdown(section, 'templateType', 'Template type', 'Choose a template style for your daily news notes', { ...TEMPLATE_DESCRIPTIONS }, true);

        if (this.config.templateType === 'custom') {
            new Setting(section)
                .setName('Custom template')
                .setDesc('Define your own template using placeholders')
                .addTextArea(text => {
                    text.setPlaceholder(TEMPLATE_EXAMPLE)
                        .setValue(this.config.customTemplate)
                        .onChange(value => this.store('customTemplate', value));
                    text.inputEl.rows = 12;
                    text.inputEl.cols = 50;
                    return text;
                });

            new Setting(section)
                .setName('Validate template')
                .setDesc('Check if your custom template is valid')
                .addButton(button => button
                    .setButtonText('Validate')
                    .onClick(() => this.reportTemplateValidation(this.config.customTemplate, 'Template')));

            this.renderPlaceholderHelp(section);
        }

        if (this.config.templateType === 'file') {
            this.addText(section, 'templateFilePath', 'Template file path', 'Path to your template note (e.g., "Templates/Daily News.md")', 'Templates/Daily News.md');

            const copyExampleSetting = new Setting(section)
                .setName('Copy template example')
                .setDesc('Copy a template file example to clipboard')
                .addButton(button => button
                    .setButtonText('Copy example')
                    .onClick(async () => {
                        await navigator.clipboard.writeText(TEMPLATE_FILE_EXAMPLE);
                        new Notice('Template example copied to clipboard!', 3000);
                    }));

            // Display the example directly below the copy button
            const previewEl = section.createDiv({ cls: 'template-preview' });
            previewEl.setText(TEMPLATE_FILE_EXAMPLE);
            copyExampleSetting.settingEl.insertAdjacentElement('afterend', previewEl);

            new Setting(section)
                .setName('Validate template file')
                .setDesc('Check if your template file exists and is valid')
                .addButton(button => button
                    .setButtonText('Validate')
                    .onClick(async () => {
                        const fileContent = await TemplateEngine.loadTemplateFile(this.app, this.config.templateFilePath);
                        if (!fileContent) {
                            new Notice(`✗ Template file not found: ${this.config.templateFilePath}`, 5000);
                            return;
                        }
                        this.reportTemplateValidation(fileContent, 'Template file');
                    }));

            this.renderPlaceholderHelp(section, 'Use these placeholders in your template file.');
        }
    }

    private renderAdvanced(containerEl: HTMLElement): void {
        const section = this.createSection(containerEl, 'Advanced Configuration', 'Advanced settings for fine-tuning');
        const { pipelineMode, newsSource } = this.config;

        new Setting(section)
            .setName('Show advanced settings')
            .setDesc('Toggle advanced configuration options')
            .addToggle(toggle => toggle
                .setValue(this.showAdvanced)
                .onChange(value => {
                    this.showAdvanced = value;
                    this.display();
                }));

        if (!this.showAdvanced) return;

        if (pipelineMode === 'modular' && newsSource === 'google') {
            this.addSubheading(section, 'Search Optimization');

            new Setting(section)
                .setName('Use AI for search queries')
                .setDesc('Use Gemini AI to generate optimized Google search queries (requires Gemini API key)')
                .addToggle(toggle => toggle
                    .setValue(this.config.useAIForQueries)
                    .onChange(async (value) => {
                        if (value && !this.config.geminiApiKey) {
                            new Notice('AI search query generation requires a Gemini API key. Please add it in the API Keys section.', 6000);
                        }
                        await this.store('useAIForQueries', value);
                    }));

            this.addToggle(section, 'useAIJudge', 'Use AI news judgment', 'Let AI evaluate and select the most relevant news items', true);

            if (this.config.useAIJudge) {
                new Setting(section)
                    .setName('Custom AI judge prompt')
                    .setDesc('Optional: Custom prompt for AI news evaluation (use {{NEWS_TEXT}} and {{TOPIC}} as placeholders)')
                    .addTextArea(text => text
                        .setPlaceholder('Leave empty to use default prompt...')
                        .setValue(this.config.aiJudgePrompt || '')
                        .onChange(value => this.store('aiJudgePrompt', value)));
            }

            this.addSubheading(section, 'Cache Management');

            new Setting(section)
                .setName('Clear query cache')
                .setDesc(`Clear cached AI-generated search queries (${Object.keys(this.config.queryCache).length} cached)`)
                .addButton(button => button
                    .setButtonText('Clear cache')
                    .setWarning()
                    .onClick(async () => {
                        await this.store('queryCache', {});
                        new Notice('Query cache cleared successfully');
                        this.display();
                    }));
        }

        // Daily topic cache (available for all providers)
        this.addSubheading(section, 'Content Cache');
        this.addToggle(section, 'dailyTopicCacheEnabled', 'Enable content cache',
            'Cache daily news content to avoid redundant API calls when regenerating for the same day');

        // Count cache entries for current provider
        const currentProvider = NewsProviderFactory.getProviderKey(this.config);
        const providerCacheKeys = Object.keys(this.config.dailyTopicCache).filter(key => key.includes(`_${currentProvider}_`));

        new Setting(section)
            .setName('Clear daily topic cache')
            .setDesc(`Clear cached daily news topics for current provider (${providerCacheKeys.length} topics cached)`)
            .addButton(button => button
                .setButtonText('Clear cache')
                .setWarning()
                .onClick(async () => {
                    providerCacheKeys.forEach(key => {
                        delete this.config.dailyTopicCache[key];
                    });
                    await this.plugin.saveTopicCache();
                    new Notice(`Cleared ${providerCacheKeys.length} cached topics for ${currentProvider}`);
                    this.display();
                }));

        this.addSubheading(section, 'Custom Prompts');
        this.addToggle(section, 'useCustomPrompt', 'Use custom AI prompt', 'Enable to use your own custom AI prompt for summarization', true);

        if (this.config.useCustomPrompt) {
            const customPromptDesc = 'Your custom prompt for the AI.' + (pipelineMode === 'modular'
                ? ' (use {{NEWS_TEXT}} as placeholder for the news content)'
                : ' For agentic providers, this is used as the main instruction (e.g. "What is the latest news on {{TOPIC}}?")');

            new Setting(section)
                .setName('Custom AI prompt')
                .setDesc(customPromptDesc)
                .addTextArea(text => {
                    text.setPlaceholder('You are a professional news analyst...')
                        .setValue(this.config.customPrompt)
                        .onChange(value => this.store('customPrompt', value));
                    text.inputEl.rows = 6;
                    return text;
                });
        }

        this.addSubheading(section, 'Manual Actions');

        new Setting(section)
            .setName('Generate news now')
            .setDesc('Manually trigger news generation')
            .addButton(button => button
                .setButtonText('Generate')
                .setCta()
                .onClick(async () => {
                    new Notice('Generating news...');
                    await this.plugin.generateDailyNews();
                }));
    }
}
