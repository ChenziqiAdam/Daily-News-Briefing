import { CLAUDE_MODEL_NAME } from './constants';

export interface DailyNewsSettings {
    // Pipeline mode selection (new)
    pipelineMode: 'modular' | 'agentic';
    newsSource: 'google' | 'rss';          // modular only
    summarizer: 'gemini' | 'gpt' | 'grok' | 'claude' | 'openrouter'; // modular only
    agenticProvider: 'sonar' | 'gpt' | 'grok' | 'claude' | 'openrouter'; // agentic only

    // Legacy field — kept for backward compat / cache key derivation during migration
    apiProvider: 'google-gemini' | 'google-gpt' | 'sonar' | 'gpt' | 'google-grok' | 'grok' | 'claude' | 'openrouter' | 'google-claude' | 'google-openrouter' | 'rss-gemini' | 'rss-gpt' | 'rss-claude' | 'rss-grok' | 'rss-openrouter';

    // Google API settings
    googleSearchApiKey: string;
    googleSearchEngineId: string;
    geminiApiKey: string;

    // Perplexity API settings
    perplexityApiKey: string;

    // OpenAI API settings
    openaiApiKey: string;

    // Grok API settings
    grokApiKey: string;

    // Anthropic API settings
    anthropicApiKey: string;

    // OpenRouter API settings
    openrouterApiKey: string;
    openrouterModel: string;

    // RSS settings
    rssFeeds: string[];

    // Core functionality
    topics: string[];
    scheduleTime: string;
    archiveFolder: string;
    
    // Language settings
    language: string; // ISO 639-1 language code (e.g., 'en', 'fr', 'de')
    
    // Content quality settings
    resultsPerTopic: number;
    maxSearchResults: number;

    // Output settings
    outputFormat: 'detailed' | 'concise';
    enableNotifications: boolean;
    enableAnalysisContext: boolean; // New: Enable or disable "Analysis & Context" feature
    
    // Metadata settings
    enableMetadata: boolean;
    includeDatetime: boolean;
    includeTopics: boolean;
    includeTags: boolean;
    includeLanguage: boolean;
    includeProcessingTime: boolean;
    includeSource: boolean;
    includeOutputFormat: boolean;
    
    // Advanced settings
    dateRange: string;
    minContentLength: number;
    useCustomPrompt: boolean;
    customPrompt: string;
    strictQualityFiltering: boolean;
    qualityThreshold: number; // New setting for fine-tuning filtering
    useAIForQueries: boolean; // New setting: whether to use AI to generate search queries
    useAIJudge: boolean; // Whether to use AI for judging content quality
    aiJudgePrompt: string; // Custom prompt for AI judge, empty by default

    // Template settings
    templateType: 'default' | 'minimal' | 'detailed' | 'custom' | 'file';
    customTemplate: string; // Custom template with placeholders
    templateFilePath: string; // Path to template note file

    // Cache settings
    queryCache: { [topic: string]: string }; // AI-generated query cache: topic -> query
    dailyTopicCache: { [cacheKey: string]: TopicContent }; // Per-topic cache: "date_provider_topic" -> TopicContent
}

export const DEFAULT_SETTINGS: DailyNewsSettings = {
    // Pipeline mode (new)
    pipelineMode: 'modular',
    newsSource: 'google',
    summarizer: 'gemini',
    agenticProvider: 'sonar',

    // Legacy field (kept for cache key compatibility)
    apiProvider: 'google-gemini', // Default to Google for backward compatibility

    // Google API settings
    googleSearchApiKey: '',
    googleSearchEngineId: '',
    geminiApiKey: '',

    // Perplexity API settings
    perplexityApiKey: '',

    // OpenAI API settings
    openaiApiKey: '',

    // Grok API settings
    grokApiKey: '',

    // Anthropic API settings
    anthropicApiKey: '',

    // OpenRouter API settings
    openrouterApiKey: '',
    openrouterModel: CLAUDE_MODEL_NAME,

    // RSS settings
    rssFeeds: [],

    // Core functionality
    topics: ['Technology', 'World News'],
    scheduleTime: '08:00',
    archiveFolder: 'News Archive',
    
    // Language settings
    language: 'en', // Default to English
    
    // Content quality settings
    resultsPerTopic: 8,
    maxSearchResults: 30,

    // Output settings
    outputFormat: 'detailed',
    enableNotifications: true,
    enableAnalysisContext: true, // Enable "Analysis & Context" feature by default
    
    // Metadata settings
    enableMetadata: false, // Disabled by default to maintain backward compatibility
    includeDatetime: true,
    includeTopics: true,
    includeTags: true,
    includeLanguage: false,
    includeProcessingTime: false,
    includeSource: false,
    includeOutputFormat: false,
    
    // Advanced settings
    dateRange: 'd3', // Changed from d2 to d3 for broader date range
    minContentLength: 80,
    useCustomPrompt: false,
    customPrompt: '',
    useAIForQueries: true, // Enable AI query generation by default
    useAIJudge: true,
    aiJudgePrompt: '', // Custom prompt for AI judge, empty by default
    strictQualityFiltering: false,
    qualityThreshold: 3,

    // Template settings
    templateType: 'default',
    customTemplate: '',
    templateFilePath: '',

    // Cache settings
    queryCache: {},
    dailyTopicCache: {}
}
export interface NewsItem {
    title: string;
    link: string;
    snippet: string;
    publishedTime?: string;
    source?: string;
    qualityScore?: number;
}

export interface SearchItem {
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

export interface SearchResponse {
    items?: SearchItem[];
    error?: {
        message: string;
        status: string;
    };
}

export type TopicStatus = {
    topic: string;
    retrievalSuccess: boolean;
    summarizationSuccess: boolean;
    newsCount: number;
    error?: string;
};

export interface NewsMetadata {
    datetime?: string;
    topics?: string[];
    tags?: string[];
    language?: string;
    processingTime?: string;
    source?: string;
    outputFormat?: string;
}

export interface TopicContent {
    topic: string;
    content: string;
    status: TopicStatus;
}

export interface TemplateData {
    // Basic placeholders
    metadata: string; // YAML frontmatter
    timestamp: string; // Generated at time
    date: string; // Current date (YYYY-MM-DD)
    time: string; // Current time (HH:MM:SS)
    tableOfContents: string; // TOC markdown
    topics: string; // All topic sections combined
    topicContents: TopicContent[]; // Individual topic data for custom loops
    processingStatus: string; // Error summary
    language: string; // Current language code

    // Fine-grained date/time placeholders
    year: string; // YYYY
    month: string; // MM
    monthName: string; // January, February, etc.
    monthNameShort: string; // Jan, Feb, etc.
    day: string; // DD
    dayName: string; // Monday, Tuesday, etc.
    dayNameShort: string; // Mon, Tue, etc.
    hour: string; // HH (24-hour)
    minute: string; // MM
    second: string; // SS

    // Metadata field placeholders (individual)
    metadataDatetime: string; // Date and/or time from metadata
    metadataTags: string; // Comma-separated tags
    metadataLanguage: string; // Language from metadata
    metadataProvider: string; // API provider name

    // Topic count placeholders
    topicCount: string; // Number of topics
    topicList: string; // Comma-separated topic names

    // Per-topic placeholders (for loop support)
    topicSections: string; // Individual topic sections with custom formatting
}