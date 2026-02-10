import { requestUrl } from 'obsidian';
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NewsItem, SearchResponse, DailyNewsSettings } from '../../types';
import { GEMINI_MODEL_NAME, GOOGLE_API_URL } from '../../constants';
import type { NewsRetriever } from './base-retriever';

export class GoogleSearchRetriever implements NewsRetriever {
    private settings: DailyNewsSettings;
    private saveSettingsCallback?: () => Promise<void>;

    constructor(settings: DailyNewsSettings, saveSettingsCallback?: () => Promise<void>) {
        this.settings = settings;
        this.saveSettingsCallback = saveSettingsCallback;
    }

    async fetchNews(topic: string): Promise<NewsItem[]> {
        const startTime = Date.now();
        
        const dateRangeParam = this.settings.dateRange.match(/^[dw]\d+$/) ? 
            this.settings.dateRange : 'd3';
            
        const allNews: NewsItem[] = [];
        
        let queries: {[key: string]: string} = {};
        
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
        
        queries = {
            ...queries,
            standard: this.buildOptimizedQuery(topic),
            specific: this.createSpecificQuery(topic),
            broad: this.createBroadQuery(topic),
            recent: this.createRecentQuery(topic),
            simple: `${topic} news`
        };
        
        const maxResultsPerQuery = Math.min(10, this.settings.maxSearchResults / Object.keys(queries).length);
        
        let successfulQueries = 0;
        let failedQueries = 0;
        
        await Promise.all(Object.entries(queries).map(async ([queryType, queryString]) => {
            if (allNews.length >= this.settings.maxSearchResults) {
                return;
            }
            
            try {
                const results = await this.fetchNewsFromGoogle(
                    queryString, 
                    dateRangeParam, 
                    Math.ceil(maxResultsPerQuery)
                );
                
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
        
        if (failedQueries === Object.keys(queries).length || (allNews.length === 0 && successfulQueries === 0)) {
            throw new Error(`Failed to fetch news for ${topic}. All queries failed.`);
        }
        
        let judgedNews = allNews;
        try {
            if (allNews.length > 0) {
                judgedNews = await this.judgeNewsWithAI(allNews, topic);
            }
        } catch (error) {
            console.error(`Error while judging news with AI: ${error.message}`);
            judgedNews = allNews.slice(0, this.settings.resultsPerTopic);
        }
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`Google Search: Fetched ${allNews.length} total items, AI selected ${judgedNews.length} items for ${topic} in ${elapsedTime}s`);
        
        return judgedNews;
    }

    private async generateAISearchQuery(topic: string): Promise<string | null> {
        // Check persistent cache first
        if (this.settings.queryCache[topic]) {
            console.log(`Using cached query for topic: ${topic}`);
            return this.settings.queryCache[topic];
        }

        try {
            if (!this.settings.geminiApiKey) {
                return null;
            }

            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            const model = genAI.getGenerativeModel({
                model: GEMINI_MODEL_NAME,
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    maxOutputTokens: 100
                }
            });

            const prompt = `You are a search optimization expert. Create a Google search query for the topic "${topic}" that will find recent news articles.
The generated query should:
1. Be broad enough to catch a variety of news on this topic
2. Focus primarily on recent news articles
3. Include relevant synonyms and related terms
4. Avoid overuse of restrictive operators
5. Be no more than 150 characters
6. Be in English regardless of the topic language

Only return the search query string itself, without any explanations or additional text.`;

            const result = await model.generateContent(prompt);
            const query = result.response.text().trim();

            if (query && query.length > 0 && query.length < 200) {
                // Store in persistent cache (will be saved with settings)
                this.settings.queryCache[topic] = query;
                console.log(`Generated and cached new query for topic: ${topic}`);

                // Save settings to persist cache
                if (this.saveSettingsCallback) {
                    await this.saveSettingsCallback();
                }

                return query;
            }
            return null;
        } catch (error) {
            console.error("Error generating AI search query:", error);
            return null;
        }
    }

    private async judgeNewsWithAI(newsItems: NewsItem[], topic: string): Promise<NewsItem[]> {
        if (!this.settings.useAIJudge || !this.settings.geminiApiKey) {
            return newsItems;
        }

        try {
            const genAI = new GoogleGenerativeAI(this.settings.geminiApiKey);
            const model = genAI.getGenerativeModel({
                model: GEMINI_MODEL_NAME,
                generationConfig: {
                    temperature: 0.1,
                    topK: 40,
                }
            });

            const judgePrompt = this.getAIJudgePrompt(newsItems, topic);
            const result = await model.generateContent(judgePrompt);
            const response = result.response.text();
            
            return this.parseAIJudgeResponse(response, newsItems);
            
        } catch (error) {
            console.error('AI judge error:', error);
            return newsItems.slice(0, this.settings.resultsPerTopic);
        }
    }

    private getAIJudgePrompt(newsItems: NewsItem[], topic: string): string {
        if (this.settings.aiJudgePrompt && this.settings.aiJudgePrompt.trim()) {
            const newsText = this.formatNewsForJudge(newsItems);
            return this.settings.aiJudgePrompt.replace('{{NEWS_TEXT}}', newsText).replace('{{TOPIC}}', topic);
        }

        const languageInstruction = this.settings.language !== 'en' ? 
            ` Respond entirely in the language with ISO 639-1 code "${this.settings.language}".` : '';

        const newsText = this.formatNewsForJudge(newsItems);
        
        return `You are a professional news editor evaluating news articles for a daily briefing about "${topic}".${languageInstruction}

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
    2. Select maximum ${this.settings.resultsPerTopic} items to KEEP
    3. Format your response exactly as shown below:

    ITEM_1: KEEP
    ITEM_2: SKIP
    ITEM_3: KEEP
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
        
        if (selectedItems.length === 0) {
            console.log('AI judge returned no items, using fallback selection');
            return originalItems.slice(0, Math.min(this.settings.resultsPerTopic, originalItems.length));
        }
        
        return selectedItems;
    }

    private buildOptimizedQuery(topic: string): string {
        let query = `${topic}`;
        query += ' news OR updates OR recent OR latest';
        
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
        
        query += ' -spam';
        return query;
    }

    private createSpecificQuery(topic: string): string {
        return `${topic} news article`;
    }

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
        const actualRequests = Math.min(requestsNeeded, 3);
        
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
                    url: `${GOOGLE_API_URL}?${params.toString()}`
                });
                
                const data: SearchResponse = JSON.parse(response.text);
                
                if (data.error) {
                    console.error(`Google Search API error: ${data.error.message} (${data.error.status})`);
                    requestErrors++;
                    continue;
                }
                
                if (!data || !data.items || data.items.length === 0) {
                    continue;
                }
                
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
        
        if (requestErrors === actualRequests && allResults.length === 0) {
            throw new Error(`All ${requestErrors} API requests failed for query: ${query}`);
        }
        
        return allResults;
    }
    
    private cleanNewsContent(text: string): string {
        if (!text) return '';
        
        return text
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\S+@\S+\.\S+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}
