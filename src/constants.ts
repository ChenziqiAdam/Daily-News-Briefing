// API and Model Constants
export const GEMINI_MODEL_NAME = "gemini-2.5-flash";
export const GPT_MODEL_NAME = "gpt-5-search-api";
export const PERPLEXITY_MODEL_NAME = "sonar";
export const GROK_MODEL_NAME = "grok-4-fast";
export const CLAUDE_MODEL_NAME = "claude-sonnet-4-5-20250929";
export const GOOGLE_API_URL = "https://www.googleapis.com/customsearch/v1";
export const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
export const OPENAI_API_URL = "https://api.openai.com/v1";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// OpenRouter Constants
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-4.5-sonnet";
export const OPENROUTER_MODELS = [
    { id: 'anthropic/claude-4.5-sonnet', name: 'Claude 4.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini Flash 2.5' },
    { id: 'mistralai/mistral-large', name: 'Mistral Large' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
];

// List of high-quality news sources
export const QUALITY_NEWS_SOURCES = [
    // Major global news organizations
    'nytimes.com', 'bbc.com', 'reuters.com', 'apnews.com', 'economist.com',
    'wsj.com', 'ft.com', 'bloomberg.com', 'theguardian.com', 'npr.org',
    'washingtonpost.com', 'aljazeera.com', 'time.com', 'latimes.com',
    
    // Tech news
    'wired.com', 'techcrunch.com', 'arstechnica.com', 'theverge.com', 'cnet.com',
    'zdnet.com', 'engadget.com', 'venturebeat.com', 'protocol.com',
    
    // Science & Academic
    'nature.com', 'scientificamerican.com', 'science.org', 'newscientist.com',
    'pnas.org', 'sciencedaily.com', 'livescience.com', 'popsci.com', 
    
    // Business & Finance
    'cnbc.com', 'forbes.com', 'fortune.com', 'marketwatch.com', 'businessinsider.com',
    'hbr.org', 'barrons.com', 'morningstar.com', 'fastcompany.com',
    
    // Analysis & Long form
    'theatlantic.com', 'newyorker.com', 'politico.com', 'foreignpolicy.com',
    'foreignaffairs.com', 'project-syndicate.org', 'brookings.edu', 'axios.com',
    
    // Public & International news
    'france24.com', 'dw.com', 'abc.net.au', 'cbc.ca', 'japantimes.co.jp',
    'independent.co.uk', 'thehindu.com', 'straitstimes.com', 'themoscowtimes.com',
    'scmp.com'
];

// Common patterns that indicate ads or low-quality content
export const AD_PATTERNS = [
    'Subscribe to read', 'Sign up now', 'Advertisement', 'Click here to',
    'Special offer', 'newsletters?\b', '\\d+', '©\\s*\\d{4}',
    'cookie', 'subscribe', 'sign up', 'privacy policy', 'terms of service'
];

// Language translations for different UI elements
export const LANGUAGE_TRANSLATIONS: Record<string, Record<string, string>> = {
    'en': {
        keyDevelopments: 'Key Developments',
        analysisContext: 'Analysis & Context',
        processingStatus: 'Processing Status',
        generatedAt: 'Generated at',
        tableOfContents: 'Table of Contents',
        noRecentNews: 'No recent news found for',
        errorRetrieving: 'Error retrieving news for',
        limitedNews: 'Limited substantive news found on'
    },
    'fr': {
        keyDevelopments: 'Développements Clés',
        analysisContext: 'Analyse et Contexte',
        processingStatus: 'Statut du Traitement',
        generatedAt: 'Généré à',
        tableOfContents: 'Table des Matières',
        noRecentNews: 'Aucune actualité récente trouvée pour',
        errorRetrieving: 'Erreur lors de la récupération des actualités pour',
        limitedNews: 'Actualités substantielles limitées trouvées sur'
    },
    'de': {
        keyDevelopments: 'Wichtige Entwicklungen',
        analysisContext: 'Analyse & Kontext',
        processingStatus: 'Verarbeitungsstatus',
        generatedAt: 'Erstellt am',
        tableOfContents: 'Inhaltsverzeichnis',
        noRecentNews: 'Keine aktuellen Nachrichten gefunden für',
        errorRetrieving: 'Fehler beim Abrufen von Nachrichten für',
        limitedNews: 'Begrenzte substanzielle Nachrichten gefunden zu'
    },
    'es': {
        keyDevelopments: 'Desarrollos Clave',
        analysisContext: 'Análisis y Contexto',
        processingStatus: 'Estado del Procesamiento',
        generatedAt: 'Generado a las',
        tableOfContents: 'Tabla de Contenidos',
        noRecentNews: 'No se encontraron noticias recientes para',
        errorRetrieving: 'Error al recuperar noticias para',
        limitedNews: 'Noticias sustanciales limitadas encontradas sobre'
    },
    'it': {
        keyDevelopments: 'Sviluppi Chiave',
        analysisContext: 'Analisi e Contesto',
        processingStatus: 'Stato di Elaborazione',
        generatedAt: 'Generato alle',
        tableOfContents: 'Sommario',
        noRecentNews: 'Nessuna notizia recente trovata per',
        errorRetrieving: 'Errore nel recuperare notizie per',
        limitedNews: 'Notizie sostanziali limitate trovate su'
    },
    'pt': {
        keyDevelopments: 'Desenvolvimentos Principais',
        analysisContext: 'Análise e Contexto',
        processingStatus: 'Status do Processamento',
        generatedAt: 'Gerado às',
        tableOfContents: 'Índice',
        noRecentNews: 'Nenhuma notícia recente encontrada para',
        errorRetrieving: 'Erro ao recuperar notícias para',
        limitedNews: 'Notícias substantivas limitadas encontradas sobre'
    },
    'zh': {
        keyDevelopments: '关键动态',
        analysisContext: '分析与背景',
        processingStatus: '处理状态',
        generatedAt: '生成时间',
        tableOfContents: '目录',
        noRecentNews: '未找到相关的最新新闻：',
        errorRetrieving: '获取新闻时出错：',
        limitedNews: '找到有限的实质性新闻：'
    }
};

// Language display names for the dropdown
export const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'fr': 'Français (French)',
    'de': 'Deutsch (German)',
    'es': 'Español (Spanish)',
    'it': 'Italiano (Italian)',
    'zh': '中文 (Chinese)',
};