import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { DailyNewsSettings } from './types';
import type DailyNewsPlugin from '../main';
import { LANGUAGE_NAMES, OPENROUTER_MODELS } from './constants';
import { TemplateEngine } from './template/template-engine';
import { TEMPLATE_DESCRIPTIONS, TEMPLATE_EXAMPLE } from './template/template-presets';

export class DailyNewsSettingTab extends PluginSettingTab {
    plugin: DailyNewsPlugin;
    showAdvanced: boolean = false;

    constructor(app: App, plugin: DailyNewsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'News Pipeline Configuration'});
        containerEl.createEl('p', {text: 'Choose your news retrieval and summarization pipeline.'});

        new Setting(containerEl)
            .setName('News Pipeline')
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

        containerEl.createEl('h2', {text: 'API Configuration'});
        containerEl.createEl('p', {text: 'API keys are required for your selected pipeline.'});

        const provider = this.plugin.settings.apiProvider;

        if (provider.startsWith('google')) {
            new Setting(containerEl)
                .setName('Google Search API key')
                .setDesc('Your Google Custom Search API key')
                .addText(text => text
                    .setPlaceholder('Enter API key')
                    .setValue(this.plugin.settings.googleSearchApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.googleSearchApiKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Google Search engine ID')
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
            new Setting(containerEl)
                .setName('Gemini API key')
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
            new Setting(containerEl)
                .setName('OpenAI API key')
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
            new Setting(containerEl)
                .setName('Perplexity API key')
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
            new Setting(containerEl)
                .setName('Grok API key')
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
            new Setting(containerEl)
                .setName('Anthropic API key')
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
            new Setting(containerEl)
                .setName('OpenRouter API key')
                .setDesc('Your OpenRouter API key')
                .addText(text => text
                    .setPlaceholder('Enter OpenRouter API key')
                    .setValue(this.plugin.settings.openrouterApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openrouterApiKey = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('OpenRouter Model')
                .setDesc('Select the AI model to use for news generation')
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

        // News Configuration section
        containerEl.createEl('h2', {text: 'News Configuration'});
        
        new Setting(containerEl)
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
        
        new Setting(containerEl)
            .setName('Topics')
            .setDesc('News topics to follow (comma-separated)')
            .addText(text => text
                .setPlaceholder('Technology, World News, Science')
                .setValue(this.plugin.settings.topics.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.topics = value.split(',').map(t => t.trim());
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Schedule time')
            .setDesc('When to generate daily news (24-hour format)')
            .addText(text => text
                .setPlaceholder('HH:MM')
                .setValue(this.plugin.settings.scheduleTime)
                .onChange(async (value) => {
                    this.plugin.settings.scheduleTime = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Archive folder')
            .setDesc('Folder to store daily news notes')
            .addText(text => text
                .setPlaceholder('News Archive')
                .setValue(this.plugin.settings.archiveFolder)
                .onChange(async (value) => {
                    this.plugin.settings.archiveFolder = value;
                    await this.plugin.saveSettings();
                }));

        if (provider.startsWith('google')) {
            containerEl.createEl('h2', {text: 'Search Configuration'});
            
            new Setting(containerEl)
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
                    
            new Setting(containerEl)
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

        new Setting(containerEl)
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
                    
        new Setting(containerEl)
            .setName('Enable analysis & context')
            .setDesc('Include analytical section in detailed news summaries')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAnalysisContext)
                .onChange(async (value) => {
                    this.plugin.settings.enableAnalysisContext = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Enable notifications')
            .setDesc('Show notifications when news is generated')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.enableNotifications = value;
                    await this.plugin.saveSettings();
                }));

        // Metadata Configuration
        containerEl.createEl('h2', {text: 'Metadata Configuration'});
        containerEl.createEl('p', {text: 'Configure YAML frontmatter metadata for generated news files.'});

        new Setting(containerEl)
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
            new Setting(containerEl)
                .setName('Include date')
                .setDesc('Add date field (YYYY-MM-DD)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeDate)
                    .onChange(async (value) => {
                        this.plugin.settings.includeDate = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include time')
                .setDesc('Add time field (HH:MM:SS)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeTime)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTime = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include topics')
                .setDesc('Add topics array')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeTopics)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTopics = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include tags')
                .setDesc('Add tags array (auto-generated from topics)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeTags)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTags = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include language')
                .setDesc('Add language code')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeLanguage)
                    .onChange(async (value) => {
                        this.plugin.settings.includeLanguage = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include source')
                .setDesc('Add news source/provider information')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeSource)
                    .onChange(async (value) => {
                        this.plugin.settings.includeSource = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include processing time')
                .setDesc('Add processing duration')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeProcessingTime)
                    .onChange(async (value) => {
                        this.plugin.settings.includeProcessingTime = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Include output format')
                .setDesc('Add output format (detailed/concise)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includeOutputFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.includeOutputFormat = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Template Configuration
        containerEl.createEl('h2', {text: 'Template Configuration'});

        new Setting(containerEl)
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
            new Setting(containerEl)
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

            new Setting(containerEl)
                .setName('Validate template')
                .setDesc('Check if your custom template is valid')
                .addButton(button => button
                    .setButtonText('Validate')
                    .onClick(() => {
                        const validation = TemplateEngine.validateTemplate(this.plugin.settings.customTemplate);
                        if (validation.valid) {
                            new Notice('Template is valid!', 3000);
                        } else {
                            new Notice(`Template errors:\n${validation.errors.join('\n')}`, 5000);
                        }
                    }));

            // Show placeholder info
            const placeholderInfoEl = containerEl.createDiv('template-placeholder-info');
            placeholderInfoEl.createEl('h4', {text: 'Available Placeholders:'});

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
            new Setting(containerEl)
                .setName('Template file path')
                .setDesc('Path to your template note (e.g., "Templates/Daily News.md")')
                .addText(text => text
                    .setPlaceholder('Templates/Daily News.md')
                    .setValue(this.plugin.settings.templateFilePath)
                    .onChange(async (value) => {
                        this.plugin.settings.templateFilePath = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
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
                            new Notice(`Template file not found: ${this.plugin.settings.templateFilePath}`, 5000);
                            return;
                        }

                        const validation = TemplateEngine.validateTemplate(fileContent);
                        if (validation.valid) {
                            new Notice('Template file is valid!', 3000);
                        } else {
                            new Notice(`Template errors:\n${validation.errors.join('\n')}`, 5000);
                        }
                    }));

            // Show placeholder info for file templates too
            const placeholderInfoEl = containerEl.createDiv('template-placeholder-info');
            placeholderInfoEl.createEl('h4', {text: 'Available Placeholders:'});
            placeholderInfoEl.createEl('p', {
                text: 'Use these placeholders in your template file. See example below.',
                cls: 'setting-item-description'
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

        containerEl.createEl('h2', {text: 'Advanced Configuration'});

        new Setting(containerEl)
            .setName('Show advanced configuration')
            .addToggle(toggle => toggle
                .setValue(this.showAdvanced)
                .onChange(value => {
                    this.showAdvanced = value;
                    this.display();
                }));

        if (this.showAdvanced) {
            if (provider.startsWith('google')) {
                new Setting(containerEl)
                .setName('Use AI for search queries')
                .setDesc('Use AI to generate optimized search queries (uses Gemini API)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useAIForQueries)
                    .onChange(async (value) => {
                        this.plugin.settings.useAIForQueries = value;
                        await this.plugin.saveSettings();
                    }));

                new Setting(containerEl)
                    .setName('Search date range')
                    .setDesc('How far back to search (d1 = 1 day, d2 = 2 days, w1 = 1 week)')
                    .addText(text => text
                        .setPlaceholder('d2')
                        .setValue(this.plugin.settings.dateRange)
                        .onChange(async (value) => {
                            this.plugin.settings.dateRange = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
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
                    new Setting(containerEl)
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
            }
            
            new Setting(containerEl)
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
                
                new Setting(containerEl)
                    .setName('Custom AI prompt')
                    .setDesc(customPromptDesc)
                    .addTextArea(text => text
                        .setPlaceholder('You are a professional news analyst...')
                        .setValue(this.plugin.settings.customPrompt)
                        .onChange(async (value) => {
                            this.plugin.settings.customPrompt = value;
                            await this.plugin.saveSettings();
                        }));
            }
                    
            new Setting(containerEl)
                .setName('Generate news now')
                .setDesc('Manually trigger news generation')
                .addButton(button => button
                    .setButtonText('Generate')
                    .onClick(async () => {
                        new Notice('Generating news...');
                        await this.plugin.generateDailyNews();
                    }));
        }
    }
}