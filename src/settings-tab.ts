import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { DailyNewsSettings } from './types';
import type DailyNewsPlugin from '../main';
import { LANGUAGE_NAMES, OPENROUTER_MODELS } from './constants';
import { TemplateEngine } from './template/template-engine';
import { TEMPLATE_DESCRIPTIONS, TEMPLATE_EXAMPLE, TEMPLATE_FILE_EXAMPLE } from './template/template-presets';

export class DailyNewsSettingTab extends PluginSettingTab {
    plugin: DailyNewsPlugin;
    showAdvanced: boolean = false;
    showMetadataDetails: boolean = false;
    showTemplatePlaceholders: boolean = false;

    constructor(app: App, plugin: DailyNewsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private addStyles(containerEl: HTMLElement): void {
        const styleEl = containerEl.createEl('style');
        styleEl.textContent = `
            .settings-section {
                margin-bottom: 2em;
                padding: 1.5em;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background-color: var(--background-secondary);
            }
            .settings-section-title {
                margin-top: 0 !important;
                margin-bottom: 0.5em !important;
                color: var(--text-accent);
                font-size: 1.2em;
            }
            .settings-section-description {
                margin-top: 0 !important;
                margin-bottom: 1em !important;
                color: var(--text-muted);
                font-size: 0.95em;
            }
            .collapsible-header {
                cursor: pointer;
                user-select: none;
                display: flex;
                align-items: center;
                gap: 0.5em;
                padding: 0.5em;
                background-color: var(--background-primary-alt);
                border-radius: 4px;
                margin-bottom: 0.5em;
            }
            .collapsible-header:hover {
                background-color: var(--background-modifier-hover);
            }
            .collapsible-icon {
                transition: transform 0.2s;
            }
            .collapsible-icon.expanded {
                transform: rotate(90deg);
            }
            .collapsible-content {
                margin-left: 1.5em;
                margin-top: 0.5em;
            }
            .template-placeholder-info {
                margin-top: 1em;
                padding: 1em;
                background-color: var(--background-primary-alt);
                border-radius: 4px;
                font-size: 0.9em;
            }
            .placeholder-category {
                margin-bottom: 1em;
            }
            .placeholder-category ul {
                margin-top: 0.5em;
            }
            .setting-item-heading {
                font-weight: 600;
                color: var(--text-normal);
                margin-top: 1em;
                margin-bottom: 0.5em;
            }
        `;
    }

    private createSection(containerEl: HTMLElement, title: string, description?: string): HTMLElement {
        const section = containerEl.createDiv('settings-section');
        section.createEl('h2', {text: title, cls: 'settings-section-title'});
        if (description) {
            section.createEl('p', {text: description, cls: 'settings-section-description'});
        }
        return section;
    }

    private createCollapsible(containerEl: HTMLElement, title: string, isExpanded: boolean, onToggle: (expanded: boolean) => void): { header: HTMLElement; content: HTMLElement } {
        const header = containerEl.createDiv('collapsible-header');
        const icon = header.createSpan({ text: '▶', cls: 'collapsible-icon' });
        if (isExpanded) {
            icon.addClass('expanded');
        }
        header.createSpan({ text: title });

        const content = containerEl.createDiv('collapsible-content');
        content.style.display = isExpanded ? 'block' : 'none';

        header.addEventListener('click', () => {
            const newState = !isExpanded;
            icon.toggleClass('expanded', newState);
            content.style.display = newState ? 'block' : 'none';
            onToggle(newState);
        });

        return { header, content };
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        // Add custom styles
        this.addStyles(containerEl);

        // =========================
        // Pipeline Configuration
        // =========================
        const pipelineSection = this.createSection(containerEl, '🔌 News Pipeline', 'Choose your news retrieval and summarization pipeline');

        new Setting(pipelineSection)
            .setName('Pipeline')
            .setDesc('Select your preferred pipeline')
            .addDropdown(dropdown => dropdown
                .addOption('google-gemini', 'Google Search + Gemini Summarizer')
                .addOption('google-gpt', 'Google Search + GPT Summarizer')
                .addOption('google-grok', 'Google Search + Grok Summarizer')
                .addOption('google-claude', 'Google Search + Claude Summarizer')
                .addOption('google-openrouter', 'Google Search + OpenRouter Summarizer')
                .addOption('sonar', 'Perplexity (Agentic Search)')
                .addOption('gpt', 'OpenAI GPT (Agentic Search)')
                .addOption('grok', 'Grok (Agentic Search)')
                .addOption('claude', 'Claude (Agentic Search)')
                .addOption('openrouter', 'OpenRouter (Agentic Search)')
                .setValue(this.plugin.settings.apiProvider)
                .onChange(async (value: 'google-gemini' | 'google-gpt' | 'sonar' | 'gpt' | 'google-grok' | 'grok' | 'claude' | 'openrouter' | 'google-claude' | 'google-openrouter') => {
                    this.plugin.settings.apiProvider = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // =========================
        // API Configuration
        // =========================
        const apiSection = this.createSection(containerEl, '🔑 API Configuration', 'Configure API keys for your selected pipeline');

        const provider = this.plugin.settings.apiProvider;

        if (provider.startsWith('google')) {
            apiSection.createEl('div', {text: 'Google Search API', cls: 'setting-item-heading'});

            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your Google Custom Search API key')
                .addText(text => text
                    .setPlaceholder('Enter API key')
                    .setValue(this.plugin.settings.googleSearchApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.googleSearchApiKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(apiSection)
                .setName('Search engine ID')
                .setDesc('Your Google Custom Search Engine ID')
                .addText(text => text
                    .setPlaceholder('Enter search engine ID')
                    .setValue(this.plugin.settings.googleSearchEngineId)
                    .onChange(async (value) => {
                        this.plugin.settings.googleSearchEngineId = value;
                        await this.plugin.saveSettings();
                    }));
        }

        if (provider === 'google-gemini') {
            apiSection.createEl('div', {text: 'Gemini API', cls: 'setting-item-heading'});
            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your Google Gemini API key for news summarization')
                .addText(text => text
                    .setPlaceholder('Enter Gemini API key')
                    .setValue(this.plugin.settings.geminiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.geminiApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }

        if (provider === 'google-gpt' || provider === 'gpt') {
            apiSection.createEl('div', {text: 'OpenAI API', cls: 'setting-item-heading'});
            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your OpenAI API key')
                .addText(text => text
                    .setPlaceholder('Enter OpenAI API key')
                    .setValue(this.plugin.settings.openaiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openaiApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }

        if (provider === 'sonar') {
            apiSection.createEl('div', {text: 'Perplexity API', cls: 'setting-item-heading'});
            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your Perplexity API key')
                .addText(text => text
                    .setPlaceholder('Enter Perplexity API key')
                    .setValue(this.plugin.settings.perplexityApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexityApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }

        if (provider === 'google-grok' || provider === 'grok') {
            apiSection.createEl('div', {text: 'Grok API', cls: 'setting-item-heading'});
            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your Grok API key')
                .addText(text => text
                    .setPlaceholder('Enter Grok API key')
                    .setValue(this.plugin.settings.grokApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.grokApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }

        if (provider === 'claude' || provider === 'google-claude') {
            apiSection.createEl('div', {text: 'Anthropic API', cls: 'setting-item-heading'});
            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your Anthropic API key for Claude')
                .addText(text => text
                    .setPlaceholder('Enter Anthropic API key')
                    .setValue(this.plugin.settings.anthropicApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.anthropicApiKey = value;
                        await this.plugin.saveSettings();
                    }));
        }

        if (provider === 'openrouter' || provider === 'google-openrouter') {
            apiSection.createEl('div', {text: 'OpenRouter API', cls: 'setting-item-heading'});
            new Setting(apiSection)
                .setName('API key')
                .setDesc('Your OpenRouter API key')
                .addText(text => text
                    .setPlaceholder('Enter OpenRouter API key')
                    .setValue(this.plugin.settings.openrouterApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openrouterApiKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(apiSection)
                .setName('Model')
                .setDesc('Select the AI model to use')
                .addDropdown(dropdown => {
                    OPENROUTER_MODELS.forEach(model => {
                        dropdown.addOption(model.id, model.name);
                    });
                    return dropdown
                        .setValue(this.plugin.settings.openrouterModel)
                        .onChange(async (value) => {
                            this.plugin.settings.openrouterModel = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // =========================
        // News Configuration
        // =========================
        const newsSection = this.createSection(containerEl, '📰 News Configuration', 'Configure news topics, language, and output preferences');

        new Setting(newsSection)
            .setName('Language')
            .setDesc('Language for news content and UI elements')
            .addDropdown(dropdown => {
                Object.entries(LANGUAGE_NAMES).forEach(([code, name]) => {
                    dropdown.addOption(code, name);
                });

                return dropdown
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(newsSection)
            .setName('Topics')
            .setDesc('News topics to follow (comma-separated)')
            .addText(text => text
                .setPlaceholder('Technology, World News, Science')
                .setValue(this.plugin.settings.topics.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.topics = value.split(',').map(t => t.trim());
                    await this.plugin.saveSettings();
                }));

        new Setting(newsSection)
            .setName('Output style')
            .setDesc('Choose level of detail for news summaries')
            .addDropdown(dropdown => dropdown
                .addOption('detailed', 'Detailed - with analysis')
                .addOption('concise', 'Concise - just facts')
                .setValue(this.plugin.settings.outputFormat)
                .onChange(async (value: 'detailed' | 'concise') => {
                    this.plugin.settings.outputFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(newsSection)
            .setName('Enable analysis & context')
            .setDesc('Include analytical section in detailed news summaries')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAnalysisContext)
                .onChange(async (value) => {
                    this.plugin.settings.enableAnalysisContext = value;
                    await this.plugin.saveSettings();
                }));

        if (provider.startsWith('google')) {
            newsSection.createEl('div', {text: 'Search Settings', cls: 'setting-item-heading'});

            new Setting(newsSection)
                .setName('News items per topic')
                .setDesc('Maximum number of news items to include per topic')
                .addSlider(slider => slider
                    .setLimits(3, 15, 1)
                    .setValue(this.plugin.settings.resultsPerTopic)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.resultsPerTopic = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(newsSection)
                .setName('Maximum search results')
                .setDesc('Total search results to fetch (higher values give more options but use more API quota)')
                .addSlider(slider => slider
                    .setLimits(10, 50, 5)
                    .setValue(this.plugin.settings.maxSearchResults)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxSearchResults = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // =========================
        // Scheduling & Storage
        // =========================
        const scheduleSection = this.createSection(containerEl, '⏰ Scheduling & Storage', 'Configure when and where to generate news');

        new Setting(scheduleSection)
            .setName('Schedule time')
            .setDesc('When to generate daily news (24-hour format, e.g., 08:00)')
            .addText(text => text
                .setPlaceholder('HH:MM')
                .setValue(this.plugin.settings.scheduleTime)
                .onChange(async (value) => {
                    this.plugin.settings.scheduleTime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(scheduleSection)
            .setName('Archive folder')
            .setDesc('Folder to store daily news notes')
            .addText(text => text
                .setPlaceholder('News Archive')
                .setValue(this.plugin.settings.archiveFolder)
                .onChange(async (value) => {
                    this.plugin.settings.archiveFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(scheduleSection)
            .setName('Enable notifications')
            .setDesc('Show notifications when news is generated')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.enableNotifications = value;
                    await this.plugin.saveSettings();
                }));

        // =========================
        // Metadata Configuration
        // =========================
        const metadataSection = this.createSection(containerEl, '📋 Metadata Configuration', 'Configure YAML frontmatter metadata for generated news files');

        new Setting(metadataSection)
            .setName('Enable metadata')
            .setDesc('Add YAML frontmatter metadata to generated news files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableMetadata)
                .onChange(async (value) => {
                    this.plugin.settings.enableMetadata = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.enableMetadata) {
            const { content: metadataContent } = this.createCollapsible(
                metadataSection,
                'Metadata Fields',
                this.showMetadataDetails,
                (expanded) => { this.showMetadataDetails = expanded; }
            );

            new Setting(metadataContent)
                .setName('Include date')
                .setDesc('Add date field (YYYY-MM-DD)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeDate)
                    .onChange(async (value) => {
                        this.plugin.settings.includeDate = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include time')
                .setDesc('Add time field (HH:MM:SS)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeTime)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTime = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include topics')
                .setDesc('Add topics array')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeTopics)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTopics = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include tags')
                .setDesc('Add tags array (auto-generated from topics)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeTags)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTags = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include language')
                .setDesc('Add language code')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeLanguage)
                    .onChange(async (value) => {
                        this.plugin.settings.includeLanguage = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include source')
                .setDesc('Add news source/provider information')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeSource)
                    .onChange(async (value) => {
                        this.plugin.settings.includeSource = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include processing time')
                .setDesc('Add processing duration')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeProcessingTime)
                    .onChange(async (value) => {
                        this.plugin.settings.includeProcessingTime = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(metadataContent)
                .setName('Include output format')
                .setDesc('Add output format (detailed/concise)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeOutputFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.includeOutputFormat = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // =========================
        // Template Configuration
        // =========================
        const templateSection = this.createSection(containerEl, '📝 Template Configuration', 'Customize the format of your daily news notes');

        new Setting(templateSection)
            .setName('Template type')
            .setDesc('Choose a template style for your daily news notes')
            .addDropdown(dropdown => dropdown
                .addOption('default', TEMPLATE_DESCRIPTIONS.default)
                .addOption('minimal', TEMPLATE_DESCRIPTIONS.minimal)
                .addOption('detailed', TEMPLATE_DESCRIPTIONS.detailed)
                .addOption('custom', TEMPLATE_DESCRIPTIONS.custom)
                .addOption('file', TEMPLATE_DESCRIPTIONS.file)
                .setValue(this.plugin.settings.templateType)
                .onChange(async (value: 'default' | 'minimal' | 'detailed' | 'custom' | 'file') => {
                    this.plugin.settings.templateType = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.templateType === 'custom') {
            new Setting(templateSection)
                .setName('Custom template')
                .setDesc('Define your own template using placeholders')
                .addTextArea(text => {
                    text.setPlaceholder(TEMPLATE_EXAMPLE)
                        .setValue(this.plugin.settings.customTemplate)
                        .onChange(async (value) => {
                            this.plugin.settings.customTemplate = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.rows = 12;
                    text.inputEl.cols = 50;
                    return text;
                });

            new Setting(templateSection)
                .setName('Validate template')
                .setDesc('Check if your custom template is valid')
                .addButton(button => button
                    .setButtonText('Validate')
                    .onClick(() => {
                        const validation = TemplateEngine.validateTemplate(this.plugin.settings.customTemplate);
                        if (validation.valid) {
                            new Notice('✓ Template is valid!', 3000);
                        } else {
                            new Notice(`✗ Template errors:\n${validation.errors.join('\n')}`, 5000);
                        }
                    }));

            const { content: placeholdersContent } = this.createCollapsible(
                templateSection,
                'Available Placeholders',
                this.showTemplatePlaceholders,
                (expanded) => { this.showTemplatePlaceholders = expanded; }
            );

            const placeholderInfoEl = placeholdersContent.createDiv('template-placeholder-info');
            TemplateEngine.getPlaceholderInfo().forEach(category => {
                const categoryEl = placeholderInfoEl.createEl('div', {cls: 'placeholder-category'});
                categoryEl.createEl('strong', {text: category.category + ':'});
                const placeholderList = categoryEl.createEl('ul');

                category.placeholders.forEach(info => {
                    const li = placeholderList.createEl('li');
                    li.createEl('code', {text: info.placeholder});
                    li.appendText(` - ${info.description}`);
                });
            });
        }

        if (this.plugin.settings.templateType === 'file') {
            new Setting(templateSection)
                .setName('Template file path')
                .setDesc('Path to your template note (e.g., "Templates/Daily News.md")')
                .addText(text => text
                    .setPlaceholder('Templates/Daily News.md')
                    .setValue(this.plugin.settings.templateFilePath)
                    .onChange(async (value) => {
                        this.plugin.settings.templateFilePath = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(templateSection)
                .setName('Copy template example')
                .setDesc('Copy a template file example to clipboard')
                .addButton(button => button
                    .setButtonText('Copy example')
                    .onClick(async () => {
                        await navigator.clipboard.writeText(TEMPLATE_FILE_EXAMPLE);
                        new Notice('Template example copied to clipboard!', 3000);
                    }));

            new Setting(templateSection)
                .setName('Validate template file')
                .setDesc('Check if your template file exists and is valid')
                .addButton(button => button
                    .setButtonText('Validate')
                    .onClick(async () => {
                        const fileContent = await TemplateEngine.loadTemplateFile(
                            this.app,
                            this.plugin.settings.templateFilePath
                        );

                        if (!fileContent) {
                            new Notice(`✗ Template file not found: ${this.plugin.settings.templateFilePath}`, 5000);
                            return;
                        }

                        const validation = TemplateEngine.validateTemplate(fileContent);
                        if (validation.valid) {
                            new Notice('✓ Template file is valid!', 3000);
                        } else {
                            new Notice(`✗ Template errors:\n${validation.errors.join('\n')}`, 5000);
                        }
                    }));

            const { content: placeholdersContent } = this.createCollapsible(
                templateSection,
                'Available Placeholders',
                this.showTemplatePlaceholders,
                (expanded) => { this.showTemplatePlaceholders = expanded; }
            );

            const placeholderInfoEl = placeholdersContent.createDiv('template-placeholder-info');
            placeholderInfoEl.createEl('p', {
                text: 'Use these placeholders in your template file.',
                cls: 'settings-section-description'
            });

            TemplateEngine.getPlaceholderInfo().forEach(category => {
                const categoryEl = placeholderInfoEl.createEl('div', {cls: 'placeholder-category'});
                categoryEl.createEl('strong', {text: category.category + ':'});
                const placeholderList = categoryEl.createEl('ul');

                category.placeholders.forEach(info => {
                    const li = placeholderList.createEl('li');
                    li.createEl('code', {text: info.placeholder});
                    li.appendText(` - ${info.description}`);
                });
            });
        }

        // =========================
        // Advanced Configuration
        // =========================
        const advancedSection = this.createSection(containerEl, '⚙️ Advanced Configuration', 'Advanced settings for fine-tuning');

        new Setting(advancedSection)
            .setName('Show advanced settings')
            .setDesc('Toggle advanced configuration options')
            .addToggle(toggle => toggle
                .setValue(this.showAdvanced)
                .onChange(value => {
                    this.showAdvanced = value;
                    this.display();
                }));

        if (this.showAdvanced) {
            if (provider.startsWith('google')) {
                advancedSection.createEl('div', {text: 'Search Optimization', cls: 'setting-item-heading'});

                new Setting(advancedSection)
                    .setName('Use AI for search queries')
                    .setDesc('Use AI to generate optimized search queries (uses Gemini API)')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.useAIForQueries)
                        .onChange(async (value) => {
                            this.plugin.settings.useAIForQueries = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(advancedSection)
                    .setName('Use AI news judgment')
                    .setDesc('Let AI evaluate and select the most relevant news items')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.useAIJudge)
                        .onChange(async (value) => {
                            this.plugin.settings.useAIJudge = value;
                            await this.plugin.saveSettings();
                            this.display();
                        }));

                if (this.plugin.settings.useAIJudge) {
                    new Setting(advancedSection)
                        .setName('Custom AI judge prompt')
                        .setDesc('Optional: Custom prompt for AI news evaluation (use {{NEWS_TEXT}} and {{TOPIC}} as placeholders)')
                        .addTextArea(text => text
                            .setPlaceholder('Leave empty to use default prompt...')
                            .setValue(this.plugin.settings.aiJudgePrompt || '')
                            .onChange(async (value) => {
                                this.plugin.settings.aiJudgePrompt = value;
                                await this.plugin.saveSettings();
                            }));
                }

                new Setting(advancedSection)
                    .setName('Search date range')
                    .setDesc('How far back to search (d1 = 1 day, d2 = 2 days, w1 = 1 week)')
                    .addText(text => text
                        .setPlaceholder('d2')
                        .setValue(this.plugin.settings.dateRange)
                        .onChange(async (value) => {
                            this.plugin.settings.dateRange = value;
                            await this.plugin.saveSettings();
                        }));

                advancedSection.createEl('div', {text: 'Cache Management', cls: 'setting-item-heading'});

                new Setting(advancedSection)
                    .setName('Clear query cache')
                    .setDesc(`Clear cached AI-generated search queries (${Object.keys(this.plugin.settings.queryCache).length} cached)`)
                    .addButton(button => button
                        .setButtonText('Clear cache')
                        .setWarning()
                        .onClick(async () => {
                            this.plugin.settings.queryCache = {};
                            await this.plugin.saveSettings();
                            new Notice('Query cache cleared successfully');
                            this.display();
                        }));
            }

            // Daily topic cache (available for all providers)
            advancedSection.createEl('div', {text: 'Content Cache', cls: 'setting-item-heading'});

            // Count cache entries for current provider
            const currentProvider = this.plugin.settings.apiProvider;
            const allCacheKeys = Object.keys(this.plugin.settings.dailyTopicCache);
            const providerCacheCount = allCacheKeys.filter(key => key.includes(`_${currentProvider}_`)).length;

            new Setting(advancedSection)
                .setName('Clear daily topic cache')
                .setDesc(`Clear cached daily news topics for current provider (${providerCacheCount} topics cached)`)
                .addButton(button => button
                    .setButtonText('Clear cache')
                    .setWarning()
                    .onClick(async () => {
                        // Clear only current provider's cache entries
                        const keysToDelete = allCacheKeys.filter(key => key.includes(`_${currentProvider}_`));
                        keysToDelete.forEach(key => {
                            delete this.plugin.settings.dailyTopicCache[key];
                        });
                        await this.plugin.saveSettings();
                        new Notice(`Cleared ${keysToDelete.length} cached topics for ${currentProvider}`);
                        this.display();
                    }));

            advancedSection.createEl('div', {text: 'Custom Prompts', cls: 'setting-item-heading'});

            new Setting(advancedSection)
                .setName('Use custom AI prompt')
                .setDesc('Enable to use your own custom AI prompt for summarization')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useCustomPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.useCustomPrompt = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.useCustomPrompt) {
                let customPromptDesc = 'Your custom prompt for the AI.';
                if (provider.startsWith('google')) {
                    customPromptDesc += ' (use {{NEWS_TEXT}} as placeholder for the news content)';
                } else {
                    customPromptDesc += ' For agentic providers, this is used as the main instruction (e.g. "What is the latest news on {{TOPIC}}?")';
                }

                new Setting(advancedSection)
                    .setName('Custom AI prompt')
                    .setDesc(customPromptDesc)
                    .addTextArea(text => {
                        text.setPlaceholder('You are a professional news analyst...')
                            .setValue(this.plugin.settings.customPrompt)
                            .onChange(async (value) => {
                                this.plugin.settings.customPrompt = value;
                                await this.plugin.saveSettings();
                            });
                        text.inputEl.rows = 6;
                        return text;
                    });
            }

            advancedSection.createEl('div', {text: 'Manual Actions', cls: 'setting-item-heading'});

            new Setting(advancedSection)
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
}
