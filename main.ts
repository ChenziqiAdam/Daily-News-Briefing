import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, requestUrl } from 'obsidian';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface DailyNewsSettings {
    // API provider selection
    apiProvider: 'google' | 'sonar';

    // Google API settings
    googleSearchApiKey: string;
    googleSearchEngineId: string;
    geminiApiKey: string;

    // Perplexity API settings
    perplexityApiKey: string;
    
    // Core functionality
    topics: string[];
    scheduleTime: string;
    archiveFolder: string;
    
    // Content quality settings
    resultsPerTopic: number;
    maxSearchResults: number;
    
    // Output settings
    outputFormat: 'detailed' | 'concise';
    enableNotifications: boolean;
    enableAnalysisContext: boolean; // New: Enable or disable "Analysis & Context" feature
    enableDailyNoteLink: boolean; // New: Enable linking to Obsidian daily notes
    
    // Advanced settings
    dateRange: string;
    useCustomPrompt: boolean;
    customPrompt: string;
    useAIForQueries: boolean; // New setting: whether to use AI to generate search queries
    useAIJudge: boolean; // Whether to use AI for judging content quality
    aiJudgePrompt: string; // Custom prompt for AI judge, empty by default
}

const DEFAULT_SETTINGS: DailyNewsSettings = {
    // API provider selection
    apiProvider: 'google', // Default to Google for backward compatibility

    // Google API settings
    googleSearchApiKey: '',
    googleSearchEngineId: '',
    geminiApiKey: '',

    // Perplexity API settings
    perplexityApiKey: '',
    
    // Core functionality
    topics: ['Technology', 'World News'],
    scheduleTime: '08:00',
    archiveFolder: 'News Archive',
    
    // Content quality settings
    resultsPerTopic: 8,
    maxSearchResults: 30,
    
    // Output settings
    outputFormat: 'detailed',
    enableNotifications: true,
    enableAnalysisContext: true, // Enable "Analysis & Context" feature by default
    enableDailyNoteLink: true, // Enable daily note linking by default
    
    // Advanced settings
    dateRange: 'd3', // Changed from d2 to d3 for broader date range
    useCustomPrompt: false,
    customPrompt: '',
    useAIForQueries: true, // Enable AI query generation by default
    useAIJudge: true,
    aiJudgePrompt: '' // Custom prompt for AI judge, empty by default
}

interface NewsItem {
    title: string;
    link: string;
    snippet: string;
    publishedTime?: string;
    source?: string;
}

interface SearchItem {
    title: string;
    link: string;
    snippet: string;
    pagemap?: {
        metatags?: Array<{
            publishedTime?: string;
            og_site_name?: string;
        }>;
    };
}

interface SearchResponse {
    items?: SearchItem[];
    error?: {
        message: string;
        status: string;
    };
}

class DailyNewsSettingTab extends PluginSettingTab {
    plugin: DailyNewsPlugin;
    showAdvanced: boolean = false;

    constructor(app: App, plugin: DailyNewsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        // API Provider Configuration section
        containerEl.createEl('h2', {text: 'API Provider'});
        containerEl.createEl('p', {text: 'Choose which API provider to use for fetching news.'});

        new Setting(containerEl)
            .setName('API Provider')
            .setDesc('Select either Google APIs (requires 3 keys) or Sonar API (requires 1 key)')
            .addDropdown(dropdown => dropdown
                .addOption('google', 'Google (Search + Gemini)')
                .addOption('sonar', 'Sonar by Perplexity')
                .setValue(this.plugin.settings.apiProvider)
                .onChange(async (value: 'google' | 'sonar') => {
                    this.plugin.settings.apiProvider = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide appropriate fields
                }));

        // API Configuration section - show appropriate fields based on provider
        containerEl.createEl('h2', {text: 'API Configuration'});
        containerEl.createEl('p', {text: 'API keys are required for fetching and summarizing news.'});

        if (this.plugin.settings.apiProvider === 'google') {
            // Google API settings
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
        } else {
            // Sonar API settings
            new Setting(containerEl)
                .setName('Sonar API key')
                .setDesc('Your Perplexity Sonar API key (combines search and summarization)')
                .addText(text => text
                    .setPlaceholder('Enter Sonar API key')
                    .setValue(this.plugin.settings.perplexityApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.perplexityApiKey = value;
                        await this.plugin.saveSettings();
                    }));
            
            // Add message about Sonar API advantages
            containerEl.createEl('div', {
                text: 'Sonar API combines search and summarization in one step, providing a simpler setup with only one API key.',
                cls: 'setting-item-description'
            });
        }

        // News Configuration section
        containerEl.createEl('h2', {text: 'News Configuration'});
        
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

        if (this.plugin.settings.apiProvider === 'google') {
            // Search Configuration section
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

        // Output Settings section
        containerEl.createEl('h2', {text: 'Output Configuration'});
        
        if (this.plugin.settings.apiProvider === 'google') {
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
                    
            // Add option to enable analysis & context
            new Setting(containerEl)
                .setName('Enable analysis & context')
                .setDesc('Include analytical section in detailed news summaries')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.enableAnalysisContext)
                    .onChange(async (value) => {
                        this.plugin.settings.enableAnalysisContext = value;
                        await this.plugin.saveSettings();
                    }));
        }
                
        new Setting(containerEl)
            .setName('Enable notifications')
            .setDesc('Show notifications when news is generated')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.enableNotifications = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable daily note link')
            .setDesc('Add a link to today\'s daily note in the news briefing')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDailyNoteLink)
                .onChange(async (value) => {
                    this.plugin.settings.enableDailyNoteLink = value;
                    await this.plugin.saveSettings();
                }));

        // Advanced toggle
        new Setting(containerEl)
            .setName('Show advanced configuration')
            .addToggle(toggle => toggle
                .setValue(this.showAdvanced)
                .onChange(value => {
                    this.showAdvanced = value;
                    this.display();
                }));

        // Advanced Settings
        if (this.showAdvanced) {
            containerEl.createEl('h2', {text: 'Advanced Configuration'});

            // Add AI Query Generation setting in advanced section
            new Setting(containerEl)
                .setName('Use AI for search queries')
                .setDesc('Use AI to generate optimized search queries (uses Gemini API)')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useAIForQueries)
                    .onChange(async (value) => {
                        this.plugin.settings.useAIForQueries = value;
                        await this.plugin.saveSettings();
                    }));

            // Additional advanced settings for API-specific settings
            if (this.plugin.settings.apiProvider === 'google') {
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
                            this.display(); // Refresh to show/hide custom prompt
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
            
            // Custom prompt setting - available for both providers
            new Setting(containerEl)
                .setName('Use custom AI prompt')
                .setDesc('Enable to use your own custom AI prompt for summarization')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.useCustomPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.useCustomPrompt = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show/hide custom prompt area
                    }));
                    
            if (this.plugin.settings.useCustomPrompt) {
                const customPromptDesc = this.plugin.settings.apiProvider === 'google' 
                    ? 'Your custom prompt for the AI summarization (use {{NEWS_TEXT}} as placeholder for the news content)'
                    : 'Your custom prompt for the Sonar API (use {{NEWS_TEXT}} as placeholder for the topic search instruction)';
                
                new Setting(containerEl)
                    .setName('Custom AI prompt')
                    .setDesc(customPromptDesc)
                    .addTextArea(text => text
                        .setPlaceholder('You are a professional news analyst...\n\n{{NEWS_TEXT}}\n\nPlease summarize...')
                        .setValue(this.plugin.settings.customPrompt)
                        .onChange(async (value) => {
                            this.plugin.settings.customPrompt = value;
                            await this.plugin.saveSettings();
                        }));
            }
                    
            // Manual trigger button
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

export default class DailyNewsPlugin extends Plugin {
    settings: DailyNewsSettings;

    async onload() {
        await this.loadSettings();
        
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
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async fetchNews(topic: string): Promise<NewsItem[]> {
        const startTime = Date.now();
        
        // Get appropriate date range parameter
        const dateRangeParam = this.settings.dateRange.match(/^[dw]\d+$/) ? 
            this.settings.dateRange : 'd3';
            
        const allNews: NewsItem[] = [];
        
        // Define search queries
        let queries: {[key: string]: string} = {};
        
        // Use AI to generate the primary query if enabled
        if (this.settings.useAIForQueries && this.settings.geminiApiKey) {
            try {
                const aiQuery = await this.generateAISearchQuery(topic);
                if (aiQuery) {
                    queries.aiGenerated = aiQuery;
                }
            } catch (error) {
                console.error("Error generating AI query:", error);
            }
        }
        
        // Always include multiple query variations
        queries = {
            ...queries,
            standard: this.buildOptimizedQuery(topic),
            specific: this.createSpecificQuery(topic),
            broad: this.createBroadQuery(topic),
            recent: this.createRecentQuery(topic),
            simple: `${topic} news`
        };
        
        // Maximum results per query
        const maxResultsPerQuery = Math.min(10, this.settings.maxSearchResults / Object.keys(queries).length);
        
        // Track API call successes and failures
        let successfulQueries = 0;
        let failedQueries = 0;
        
        // Fetch results for each query type in parallel
        await Promise.all(Object.entries(queries).map(async ([queryType, queryString]) => {
            try {
                const results = await this.fetchNewsFromGoogle(
                    queryString, 
                    dateRangeParam, 
                    Math.ceil(maxResultsPerQuery)
                );
                
                // Add results while avoiding duplicates
                for (const item of results) {
                    if (!allNews.some(existing => existing.link === item.link)) {
                        allNews.push(item);
                    }
                }
                
                if (results.length > 0) {
                    successfulQueries++;
                }
            } catch (error) {
                console.error(`Error fetching ${queryType} news:`, error);
                failedQueries++;
            }
        }));
        
        // If all queries failed or no news items were found, throw an error
        if (failedQueries === Object.keys(queries).length || (allNews.length === 0 && successfulQueries === 0)) {
            throw new Error(`Failed to fetch news for ${topic}. All queries failed.`);
        }
        
        // Use AI to judge and filter news items
        let judgedNews = allNews;
        try {
            if (allNews.length > 0) {
                judgedNews = await this.judgeNewsWithAI(allNews, topic);
            }
        } catch (error) {
            console.error(`Error while judging news with AI: ${error.message}`);
            // Use original list if AI judging fails, limited to the requested number of results
            judgedNews = allNews.slice(0, this.settings.resultsPerTopic);
        }
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`Fetched ${allNews.length} total items, AI selected ${judgedNews.length} items for ${topic} in ${elapsedTime}s`);
        
        return judgedNews;
    }
    
    // Update AI query generator to create broader queries
    async generateAISearchQuery(topic: string): Promise<string | null> {
        try {
            if (!this.settings.geminiApiKey) {
                return null;
            }
            
            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.3, // Slightly increased temperature for more variety
                    topK: 40,
                    maxOutputTokens: 100
                }
            });
            
            // Modified prompt to encourage broader, more inclusive queries
            const prompt = `You are a search optimization expert. Create a Google search query for the topic "${topic}" that will find recent news articles.
The generated query should:
1. Be broad enough to catch a variety of news on this topic
2. Focus primarily on recent news articles
3. Include relevant synonyms and related terms
4. Avoid overuse of restrictive operators
5. Be no more than 150 characters

Only return the search query string itself, without any explanations or additional text.`;

            const result = await model.generateContent(prompt);
            const query = result.response.text().trim();
            
            // Verify that the query is a short and meaningful string
            if (query && query.length > 0 && query.length < 200) {
                return query;
            }
            return null;
        } catch (error) {
            console.error("Error generating AI search query:", error);
            return null;
        }
    }

    async judgeNewsWithAI(newsItems: NewsItem[], topic: string): Promise<NewsItem[]> {
        if (!this.settings.useAIJudge || !this.settings.geminiApiKey) {
            return newsItems; // If AI judgment is not used, return all news items
        }

        try {
            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig: {
                    temperature: 0.1, // Low temperature ensures consistent judgment
                    topK: 40,
                    maxOutputTokens: 2048
                }
            });

            // Build judge prompt
            const judgePrompt = this.getAIJudgePrompt(newsItems, topic);
            
            const result = await model.generateContent(judgePrompt);
            const response = result.response.text();
            
            // Parse AI judgment results
            return this.parseAIJudgeResponse(response, newsItems);
            
        } catch (error) {
            console.error('AI judge error:', error);
            // If AI judgment fails, return the first N items from the original list
            return newsItems.slice(0, this.settings.resultsPerTopic);
        }
    }

    private getAIJudgePrompt(newsItems: NewsItem[], topic: string): string {
        // 如果用户有自定义判断提示词，使用它
        if (this.settings.aiJudgePrompt && this.settings.aiJudgePrompt.trim()) {
            const newsText = this.formatNewsForJudge(newsItems);
            return this.settings.aiJudgePrompt.replace('{{NEWS_TEXT}}', newsText).replace('{{TOPIC}}', topic);
        }

        // 默认判断提示词
        const newsText = this.formatNewsForJudge(newsItems);
        
        return `You are a professional news editor evaluating news articles for a daily briefing about "${topic}".

    Please evaluate each news item and decide whether to KEEP or SKIP it based on these criteria:

    KEEP if the news item:
    - Contains specific, factual information relevant to ${topic}
    - Reports on recent developments, announcements, or events
    - Includes concrete details (numbers, dates, names, quotes)
    - Comes from a recognizable news source
    - Provides substantive information beyond headlines

    SKIP if the news item:
    - Is too vague or lacks specific details
    - Appears to be promotional content or advertisements
    - Is outdated or not recent
    - Duplicates information from other items
    - Contains mainly opinion without factual basis

    NEWS ITEMS TO EVALUATE:
    ${newsText}

    INSTRUCTIONS:
    1. For each news item, respond with either "KEEP" or "SKIP" followed by the item number
    2. If KEEP, provide a brief reason (max 20 words)
    3. Select maximum ${this.settings.resultsPerTopic} items to KEEP
    4. Format your response exactly as shown below:

    ITEM_1: KEEP - [brief reason]
    ITEM_2: SKIP - [brief reason]
    ITEM_3: KEEP - [brief reason]
    ...

    Focus on selecting the most newsworthy and informative items for the daily briefing.`;
    }

    private formatNewsForJudge(newsItems: NewsItem[]): string {
        return newsItems.map((item, index) => {
            const url = new URL(item.link);
            const domain = url.hostname.replace('www.', '');
            
            return `ITEM_${index + 1}:
    Title: ${item.title}
    Source: ${item.source || domain}
    Published: ${item.publishedTime || 'Unknown'}
    Content: ${item.snippet}
    URL: ${item.link}
    ---`;
        }).join('\n\n');
    }

    private parseAIJudgeResponse(response: string, originalItems: NewsItem[]): NewsItem[] {
        const selectedItems: NewsItem[] = [];
        const lines = response.split('\n');
        
        for (const line of lines) {
            const match = line.match(/ITEM_(\d+):\s*KEEP/i);
            if (match) {
                const itemIndex = parseInt(match[1]) - 1;
                if (itemIndex >= 0 && itemIndex < originalItems.length) {
                    selectedItems.push(originalItems[itemIndex]);
                }
            }
        }
        
        // If AI didn't select any items or response format is incorrect, return first N items as fallback
        if (selectedItems.length === 0) {
            console.log('AI judge returned no items, using fallback selection');
            return originalItems.slice(0, Math.min(this.settings.resultsPerTopic, originalItems.length));
        }
        
        return selectedItems;
    }

    // Simplified query builder with broader terms to get more results
    private buildOptimizedQuery(topic: string): string {
        // Base query with the topic
        let query = `${topic}`;
        
        // Add broader terms for all topics to increase result count
        query += ' news OR updates OR recent OR latest';
        
        // Add topic-specific terms - using more general terms
        const lowercaseTopic = topic.toLowerCase();
        
        if (lowercaseTopic.includes('tech')) {
            query += ' technology OR innovation OR digital';
        } else if (lowercaseTopic.includes('world') || lowercaseTopic.includes('global')) {
            query += ' international OR global';
        } else if (lowercaseTopic.includes('business') || lowercaseTopic.includes('finance')) {
            query += ' market OR economic OR industry';
        } else if (lowercaseTopic.includes('science')) {
            query += ' research OR discovery';
        } else if (lowercaseTopic.includes('health')) {
            query += ' medical OR healthcare';
        }
        
        // Minimal negative terms to avoid filtering too much
        query += ' -spam';
        
        return query;
    }

    // Create a more generic query to capture more results
    private createSpecificQuery(topic: string): string {
        return `${topic} news article`;
    }

    // Additional query variants to increase coverage
    private createBroadQuery(topic: string): string {
        return `latest ${topic} developments`;
    }

    private createRecentQuery(topic: string): string {
        return `${topic} this week important`;
    }

    private async fetchNewsFromGoogle(
        query: string, 
        dateRestrict: string, 
        maxResults: number = 10
    ): Promise<NewsItem[]> {
        const requestsNeeded = Math.ceil(maxResults / 10);
        const actualRequests = Math.min(requestsNeeded, 3); // 允许更多请求获取更多选项
        
        let allResults: NewsItem[] = [];
        let requestErrors = 0;
        
        for (let i = 0; i < actualRequests; i++) {
            if (allResults.length >= maxResults) break;
            
            const startIndex = (i * 10) + 1;
            
            const params = new URLSearchParams({
                key: this.settings.googleSearchApiKey,
                cx: this.settings.googleSearchEngineId,
                q: query,
                num: '10',
                dateRestrict: dateRestrict,
                fields: 'items(title,link,snippet,pagemap/metatags/publishedTime,pagemap/metatags/og_site_name)',
                sort: i === 0 ? 'date' : 'relevance',
                start: startIndex.toString()
            });
            
            try {
                const response = await requestUrl({
                    url: `https://www.googleapis.com/customsearch/v1?${params.toString()}`
                });
                
                const data: SearchResponse = JSON.parse(response.text);
                
                // Check if the API returned an error
                if (data.error) {
                    console.error(`Google Search API error: ${data.error.message} (${data.error.status})`);
                    requestErrors++;
                    continue;
                }
                
                if (!data || !data.items || data.items.length === 0) {
                    // Not considering empty results as an error, just continue
                    continue;
                }
                
                // Process results into NewsItems (without quality scoring)
                const pageResults = data.items.map(item => {
                    const url = new URL(item.link);
                    const domain = url.hostname.replace('www.', '');
                    const source = item.pagemap?.metatags?.[0]?.og_site_name || domain;
                    
                    return {
                        title: item.title,
                        link: item.link,
                        snippet: this.cleanNewsContent(item.snippet),
                        publishedTime: item.pagemap?.metatags?.[0]?.publishedTime,
                        source: source
                    };
                });
                
                // Add only non-duplicate results
                for (const item of pageResults) {
                    if (!allResults.some(existing => existing.link === item.link)) {
                        allResults.push(item);
                    }
                }
                
                if (i < actualRequests - 1) {
                    await new Promise(r => setTimeout(r, 200));
                }
                
            } catch (error) {
                console.error(`Search API error on page ${i+1}:`, error);
                requestErrors++;
            }
        }
        
        // If all requests failed and we have no results, throw an error
        if (requestErrors === actualRequests && allResults.length === 0) {
            throw new Error(`All ${requestErrors} API requests failed for query: ${query}`);
        }
        
        return allResults;
    }
    
    // Simplified content cleaning
    private cleanNewsContent(text: string): string {
        if (!text) return '';
        
        // Simple regex pattern for cleaning - combined for better performance
        return text
            .replace(/https?:\/\/\S+/g, '') // Remove URLs
            .replace(/\S+@\S+\.\S+/g, '')   // Remove emails
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .trim();                         // Trim excess whitespace
    }

    async generateSummary(newsItems: NewsItem[], topic: string): Promise<string> {
        if (!newsItems.length) {
            return `No recent news found for ${topic}.`;
        }

        // Enhance news items with quality indicators
        const enhancedNewsText = newsItems.map(item => {
            // Extract domain for credibility info
            const domain = new URL(item.link).hostname.replace('www.', '');
            
            return `=== NEWS ITEM ===\n` +
                `Title: ${item.title}\n` +
                `Source: ${item.source || domain}\n` +
                `URL: ${item.link}\n` +
                `Published: ${item.publishedTime || 'Unknown'}\n` +
                `Content: ${item.snippet}\n`;
        }).join('\n\n');

        // Get appropriate prompt
        const prompt = this.getAIPrompt(enhancedNewsText, topic, this.settings.outputFormat);

        try {
            // Check if API key is available
            if (!this.settings.geminiApiKey) {
                throw new Error('Missing Gemini API key');
            }
            
            // Initialize the Gemini API
            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            
            // Use the model "gemini-2.0-flash" for better performance
            const modelName = "gemini-2.0-flash";
                
            // console.log(`Using model ${modelName} for summarization`);
            
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                    temperature: 0.2, // Lower temperature for more factual output
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 4096
                }
            });
            
            // Set a timeout for the API call
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI summary timed out')), 30000)
            );
            
            // Run the content generation with timeout
            const resultPromise = model.generateContent(prompt);
            const result = await Promise.race([resultPromise, timeoutPromise]) as any;
            
            // Validate result structure
            if (!result || !result.response) {
                throw new Error('Invalid AI response structure');
            }
            
            // Return the summary text
            return result.response.text();
        } catch (error) {
            console.error('Failed to generate summary:', error);
            
            // This error message will help detect failures in the generateDailyNews method
            return `Error generating summary for ${topic}. ${error.message || 'Unknown error'}\n\nCheck the developer console for more information.`;
        }
    }

    // Fallback summary when AI fails
    private createFallbackSummary(newsItems: NewsItem[], topic: string): string {
        return `**Summary for ${topic}**\n\n${
            newsItems.slice(0, 5).map(item => 
                `- **${item.title}** - ${item.snippet?.substring(0, 150)}... [${item.source || new URL(item.link).hostname}](${item.link})`
            ).join('\n\n')
        }`;
    }

    private getAIPrompt(newsText: string, topic: string, format: 'detailed' | 'concise'): string {
        // If user has custom prompt enabled and provided one, use it
        if (this.settings.useCustomPrompt && this.settings.customPrompt && newsText) {
            return this.settings.customPrompt.replace('{{NEWS_TEXT}}', newsText);
        }
        
        // If no custom prompt, use default based on provider
        let basePrompt = ``;
        if (this.settings.apiProvider === 'google') {
            basePrompt = `Analyze these news articles about ${topic} and provide a substantive summary:

            ${newsText}

            KEY REQUIREMENTS:
            1. Focus on concrete developments, facts, and data
            2. For each news item include the SOURCE in markdown format: [Source](URL)
            3. Use specific dates rather than relative time references
            4. Prioritize news with specific details (numbers, names, quotes)
            5. If content lacks substance, state "Limited substantive news found on ${topic}"`;
        } else {
            // For Sonar API, use a different prompt structure
            basePrompt = `You are a helpful AI assistant. Please answer in the required format.

            KEY REQUIREMENTS:
            1. Focus on concrete developments, facts, and data
            2. For each news item include the SOURCE in markdown format: [Source](URL)
            3. Use specific dates rather than relative time references
            4. Prioritize news with specific details (numbers, names, quotes)
            5. Only return the news - do not include any meta-narratives, explanations, or instructions. 
            6. If content lacks substance, state "Limited substantive news found on ${topic}"`;

            return basePrompt;
        }

        // Add format-specific instructions
        if (format === 'detailed') {
            let formattedPrompt = basePrompt + `

Format your summary with these sections:

### Key Developments
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;

            // Only add analysis section if the feature is enabled
            if (this.settings.enableAnalysisContext) {
                formattedPrompt += `

### Analysis & Context
[Provide context, implications, or background for the most significant developments]`;
            }
            
            return formattedPrompt;
        } else {
            return basePrompt + `

Format your summary as bullet points with concrete facts:

- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)
- **[Clear headline with key detail]**: Concrete facts with specific details. [Source](URL)`;
        }
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

    async fetchAndSummarizeWithSonar(topic: string): Promise<string> {
        try {
            // Build system message based on output format
            let systemMessage = this.getAIPrompt('', topic, this.settings.outputFormat);
            
            // Prepare request body
            const requestBody = {
                model: "sonar",
                messages: [
                    {
                        role: "system",
                        content: systemMessage
                    },
                    {
                        role: "user",
                        content: `What are the latest significant news about "${topic}"?`
                    }
                ],
            };
            
            // console.log("Sonar API request:", JSON.stringify(requestBody, null, 2));
            
            // Make API request to Sonar
            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.perplexityApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            };
            
            const response = await requestUrl({
                url: 'https://api.perplexity.ai/chat/completions',
                ...options
            });
            
            if (response.status >= 200 && response.status < 300) {
                const data = JSON.parse(response.text);
                if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                    return data.choices[0].message.content;
                } else {
                    throw new Error('Invalid response format from Sonar API');
                }
            } else {
                // console.error(`Sonar API returned status ${response.status}: ${response.text}`);
                throw new Error(`Sonar API returned status ${response.status}: ${response.text}`);
            }
        } catch (error) {
            console.error('Sonar API error:', error);
            // This error message will be detected in the generateDailyNews method
            return `Error fetching news about ${topic} from Sonar API. Please check your API key and settings.\n\nError details: ${error.message}\n\nCheck the developer console for more information.`;
        }
    }

    private validateApiConfig(): boolean {
        if (this.settings.apiProvider === 'google') {
            // Check Google API settings
            if (!this.settings.googleSearchApiKey || !this.settings.googleSearchEngineId || !this.settings.geminiApiKey) {
                new Notice('Missing Google API configuration. Please check settings.', 5000);
                return false;
            }
        } else {
            // Check Sonar API settings
            if (!this.settings.perplexityApiKey) {
                new Notice('Missing Sonar API key. Please add your Perplexity API key in settings.', 5000);
                return false;
            }
        }
        return true;
    }

    async generateDailyNews() {
        // Validate API configuration first
        if (!this.validateApiConfig()) {
            return null;
        }

        const date = new Date().toISOString().split('T')[0];
        
        try {
            new Notice('Generating daily news...');
            
            // Normalize the path
            const archiveFolder = this.normalizePath(this.settings.archiveFolder);
            const fileName = `${archiveFolder}/Daily News - ${date}.md`;

            // Check if the file already exists
            if (await this.app.vault.adapter.exists(fileName)) {
                new Notice('Daily news already generated for today.', 5000);
                return fileName; // Return the path even when file exists
            }
            
            // Add YAML frontmatter metadata
            const now = new Date();
            let content = `---\n`;
            content += `MOC:\n`;
            content += `language: en\n`;
            content += `published_date: '${date}'\n`;
            content += `scraped_date: '${now.toISOString()}'\n`;
            content += `source: Daily-News-Briefing\n`;
            content += `tags:\n`;
            content += `- news\n`;
            content += `- daily-briefing\n`;
            this.settings.topics.forEach(topic => {
                content += `- ${topic.toLowerCase().replace(/\s+/g, '-')}\n`;
            });
            content += `daily_note: '[[${date}]]'\n`;
            content += `---\n\n`;

            // Add table of contents
            content += `## Table of Contents\n\n`;
            this.settings.topics.forEach(topic => {
                content += `- [${topic}](#${topic.toLowerCase().replace(/\s+/g, '%20')})\n`;
            });

            // Track topic processing status
            type TopicStatus = {
                topic: string;
                retrievalSuccess: boolean;
                summarizationSuccess: boolean;
                newsCount: number;
                error?: string;
            };
            
            const topicStatuses: TopicStatus[] = [];
            
            // Process each topic
            for (const topic of this.settings.topics) {
                const topicStatus: TopicStatus = {
                    topic: topic,
                    retrievalSuccess: false,
                    summarizationSuccess: false,
                    newsCount: 0
                };
                
                try {
                    content += `\n---\n\n`;
                    content += `## ${topic}\n\n`;
                    
                    new Notice(`Fetching news for ${topic}...`);

                    if (this.settings.apiProvider === 'google') {
                        try {
                            // Step 1: News Retrieval
                            const newsItems = await this.fetchNews(topic);
                            topicStatus.retrievalSuccess = true;
                            topicStatus.newsCount = newsItems.length;
                            
                            if (newsItems.length) {
                                try {
                                    // Step 2: News Summarization
                                    new Notice(`Summarizing ${newsItems.length} news items for ${topic}...`);
                                    const summary = await this.generateSummary(newsItems, topic);
                                    
                                    // Check if summary contains error messages
                                    if (summary.includes('Error generating summary') || summary.includes('Failed to generate')) {
                                        topicStatus.error = `Summarization failed for topic "${topic}"`;
                                        content += `**News retrieval successful, but summarization failed for ${topic}.**\n\n`;
                                        content += `${summary}\n`;
                                    } else {
                                        topicStatus.summarizationSuccess = true;
                                        content += summary + '\n';
                                    }
                                } catch (summarizationError) {
                                    console.error(`Summarization error for ${topic}:`, summarizationError);
                                    topicStatus.error = `Summarization error: ${summarizationError.message}`;
                                    content += `**News retrieval successful, but summarization failed for ${topic}.**\n\n`;
                                    content += `Error details: ${summarizationError.message}\n\n`;
                                }
                            } else {
                                content += `No recent news found for ${topic}.\n\n`;
                                topicStatus.error = `No news found for topic "${topic}"`;
                            }
                        } catch (retrievalError) {
                            console.error(`News retrieval error for ${topic}:`, retrievalError);
                            topicStatus.error = `Retrieval error: ${retrievalError.message}`;
                            content += `**Failed to retrieve news for ${topic}.**\n\n`;
                            content += `Error details: ${retrievalError.message}\n\n`;
                        }
                    } else if (this.settings.apiProvider === 'sonar') {
                        try {
                            // Sonar combines retrieval and summarization in one step
                            const summary = await this.fetchAndSummarizeWithSonar(topic);
                            
                            // Check if summary contains error messages
                            if (summary.includes('Error fetching news about') || summary.includes('API error')) {
                                topicStatus.error = `Sonar API error for topic "${topic}"`;
                                content += summary + '\n';
                            } else {
                                topicStatus.retrievalSuccess = true;
                                topicStatus.summarizationSuccess = true;
                                topicStatus.newsCount = 1; // We don't know exactly how many items Sonar found
                                content += summary + '\n';
                            }
                        } catch (sonarError) {
                            console.error(`Sonar API error for ${topic}:`, sonarError);
                            topicStatus.error = `Sonar API error: ${sonarError.message}`;
                            content += `**Failed to retrieve and summarize news for ${topic} using Sonar API.**\n\n`;
                            content += `Error details: ${sonarError.message}\n\n`;
                        }
                    }

                } catch (topicError) {
                    console.error(`Unexpected error processing topic ${topic}:`, topicError);
                    topicStatus.error = `Unexpected error: ${topicError.message}`;
                    content += `Error retrieving news for ${topic}. Please try again later.\n\n`;
                }
                
                topicStatuses.push(topicStatus);
            }

            // Analyze results to determine if note should be created
            const atLeastOneSuccessfulTopic = topicStatuses.some(status => 
                status.retrievalSuccess && status.summarizationSuccess);
                
            const atLeastOneNewsItem = topicStatuses.some(status => status.newsCount > 0);
            
            const allTopicsFailed = topicStatuses.every(status => 
                !status.retrievalSuccess || !status.summarizationSuccess);
                
            // Generate error analysis for logging
            const errorSummary = topicStatuses
                .filter(status => status.error)
                .map(status => `${status.topic}: ${status.error}`)
                .join('\n');
                
            // Decide whether to create the note
            if (allTopicsFailed || !atLeastOneSuccessfulTopic) {
                const errorMessage = atLeastOneNewsItem 
                    ? 'News was retrieved for some topics, but summarization failed for all of them.' 
                    : 'Failed to retrieve news for any topics.';
                
                if (this.settings.enableNotifications) {
                    new Notice(`${errorMessage} No note was created.`, 5000);
                }
                console.error(`${errorMessage} No note was created.\nError details:\n${errorSummary}`);
                return null;
            }

            // Create folder if it doesn't exist
            try {
                if (!(await this.app.vault.adapter.exists(archiveFolder))) {
                    await this.app.vault.createFolder(archiveFolder);
                }
            } catch (folderError) {
                console.error("Failed to create folder:", folderError);
                new Notice('Failed to create archive folder', 5000);
                return null;
            }

            // Add an error summary at the end of the note if some topics failed
            if (topicStatuses.some(status => status.error)) {
                content += '\n---\n\n';
                content += '## Processing Status\n\n';
                content += 'Some topics encountered issues during processing:\n\n';
                
                for (const status of topicStatuses) {
                    if (status.error) {
                        const stage = !status.retrievalSuccess ? 'News Retrieval' : 'News Summarization';
                        content += `- **${status.topic}**: Issue during ${stage} - ${status.error}\n`;
                    }
                }
            }

            await this.app.vault.create(fileName, content);
            
            if (this.settings.enableNotifications) {
                new Notice('Daily news generated successfully', 3000);
            }
            
            // console.log(`Created news file at: ${fileName}`);
            return fileName;
            
        } catch (error) {
            console.error('Failed to generate news:', error);
            new Notice('Failed to generate news. Check console for details.', 5000);
            return null;
        }
    }

    // Improved method to open or create daily news
    async openOrCreateDailyNews() {
        const date = new Date().toISOString().split('T')[0];
        const filePath = this.normalizePath(`${this.settings.archiveFolder}/Daily News - ${date}.md`);
        
        try {
            // Check if file exists
            const fileExists = await this.app.vault.adapter.exists(filePath);
            
            if (fileExists) {
                // If exists, open the file with more reliable method
                this.openNewsFile(filePath);
            } else {
                // If not exists, generate new one
                new Notice('Generating today\'s news briefing...');
                const createdPath = await this.generateDailyNews();
                
                if (createdPath) {
                    // Increased timeout for file system operations to complete
                    setTimeout(() => {
                        this.openNewsFile(createdPath);
                    }, 1000); // Increased delay to ensure file is created and indexed
                } else {
                    // News generation failed, show a notification
                    new Notice('Failed to generate news briefing. No note was created.', 5000);
                }
            }
        } catch (error) {
            console.error('Error opening or creating daily news:', error);
            new Notice('Unable to open or create daily news');
        }
    }

    // Helper method to generate daily note link
    private generateDailyNoteLink(dateString: string): string {
        // Try different common daily note formats
        const date = new Date(dateString);
        const formats = [
            dateString, // YYYY-MM-DD
            date.toISOString().split('T')[0], // YYYY-MM-DD (same as above, but explicit)
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, // YYYY-MM-DD
            date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'), // MM-DD-YYYY format
            date.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'), // DD-MM-YYYY format
        ];
        
        // Return a link that tries multiple formats
        const linkText = `📅 **Daily Note**: [[${dateString}]]`;
        
        return `> ${linkText}\n> *Link to today's daily note for additional context and tasks*`;
    }

    // Helper method to normalize paths for Obsidian's file system
    private normalizePath(path: string): string {
        // Ensure path doesn't start with a slash
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        
        // Replace any double slashes with single slashes
        path = path.replace(/\/+/g, '/');
        
        return path;
    }

    // Helper method to open news file with multiple fallback approaches
    private openNewsFile(filePath: string) {
        try {
            // Normalize the path for consistent handling
            filePath = this.normalizePath(filePath);
            // console.log(`Trying to open file at path: ${filePath}`);
            
            // Try to get the file from the vault
            const file = this.app.vault.getAbstractFileByPath(filePath);
            
            if (file instanceof TFile) {
                // console.log(`File found, opening: ${file.path}`);
                // Try to open the file using workspace API
                this.app.workspace.openLinkText(file.path, '', false)
                    .then(() => {
                        new Notice('Opened today\'s news briefing');
                    })
                    .catch(error => {
                        // console.error('Failed to open file with openLinkText:', error);
                        // Fallback: Try to actively focus the leaf after opening
                        this.app.workspace.getLeaf(false).openFile(file)
                            .then(() => {
                                new Notice('Opened today\'s news briefing (fallback method)');
                            })
                            .catch(e => {
                                // console.error('Both file opening methods failed:', e);
                                new Notice('Unable to open news file. Try opening it manually.');
                            });
                    });
            } else {
                // console.error(`File not found in vault at: ${filePath}`);
                new Notice(`Unable to find news file. Please check path: ${filePath}`);
            }
        } catch (error) {
            // console.error('Error in openNewsFile:', error);
            new Notice('Error opening news file');
        }
    }
}