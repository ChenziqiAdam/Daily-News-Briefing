import type { BriefingPresetId, DailyNewsSettings } from './types';

// API and Model Constants
export const GEMINI_MODEL_NAME = "gemini-2.5-flash";
export const GPT_MODEL_NAME = "gpt-5.6-sol";
export const PERPLEXITY_MODEL_NAME = "sonar";
export const GROK_MODEL_NAME = "grok-4.5";
export const CLAUDE_MODEL_NAME = "claude-sonnet-5";
export const GOOGLE_API_URL = "https://www.googleapis.com/customsearch/v1";
export const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
export const PERPLEXITY_SEARCH_API_URL = "https://api.perplexity.ai/search";
export const OPENAI_API_URL = "https://api.openai.com/v1";
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// OpenRouter Constants
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_MODEL = "anthropic/claude-sonnet-5";

export interface BriefingPresetDefinition {
    id: Exclude<BriefingPresetId, 'none'>;
    name: string;
    description: string;
    topics: string[];
    outputFormat: DailyNewsSettings['outputFormat'];
    enableAnalysisContext: boolean;
    templateType: DailyNewsSettings['templateType'];
    promptGuidance: string;
    detailedOutputGuidance: string;
    conciseOutputGuidance: string;
}

export const BRIEFING_PRESETS: Record<Exclude<BriefingPresetId, 'none'>, BriefingPresetDefinition> = {
    morning: {
        id: 'morning',
        name: 'Morning Brief',
        description: 'A focused daily briefing across global events, business, and technology.',
        topics: ['World News', 'Business', 'Technology'],
        outputFormat: 'detailed',
        enableAnalysisContext: true,
        templateType: 'default',
        promptGuidance: 'Shape the briefing for a morning reader: prioritize the most consequential developments, explain why they matter, and keep the summary easy to scan.',
        detailedOutputGuidance: 'Include brief "Why it matters" context for major items and a short "What to watch next" note when there is a clear upcoming event, deadline, decision, or risk.',
        conciseOutputGuidance: 'Keep bullets scannable for a morning read. Add a short impact phrase only when it clarifies why the item matters.'
    },
    market: {
        id: 'market',
        name: 'Market Watch',
        description: 'Track markets, monetary policy, and major technology stocks with impact-focused analysis.',
        topics: ['Stock Market', 'Federal Reserve', 'Technology Stocks'],
        outputFormat: 'detailed',
        enableAnalysisContext: true,
        templateType: 'detailed',
        promptGuidance: 'Focus on market impact, catalysts, risks, and watchlist changes. Highlight concrete price, policy, earnings, funding, or macro details when available.',
        detailedOutputGuidance: 'For each major item, identify the likely market impact, catalyst, and risk/watchlist angle. Include "What changed" when the news updates a prior trend or expectation.',
        conciseOutputGuidance: 'Keep each bullet focused on the catalyst and market implication. Include numbers, tickers, yields, prices, or policy details when available.'
    },
    'ai-tech': {
        id: 'ai-tech',
        name: 'AI/Tech Tracker',
        description: 'Follow AI products, big tech strategy, and compute infrastructure.',
        topics: ['Artificial Intelligence', 'Big Tech', 'Semiconductors'],
        outputFormat: 'detailed',
        enableAnalysisContext: true,
        templateType: 'detailed',
        promptGuidance: 'Prioritize product launches, model releases, regulation, funding, infrastructure, chips, and competitive moves. Explain practical implications for builders and operators.',
        detailedOutputGuidance: 'Add practical implications for builders, operators, or technology buyers. Call out competitive moves, ecosystem shifts, and follow-up questions worth tracking.',
        conciseOutputGuidance: 'Keep bullets focused on what launched, who is affected, and the practical implication.'
    },
    research: {
        id: 'research',
        name: 'Research Digest',
        description: 'Summarize research and science news with implications.',
        topics: ['AI Research', 'Healthcare Innovation', 'Climate Research'],
        outputFormat: 'detailed',
        enableAnalysisContext: true,
        templateType: 'detailed',
        promptGuidance: 'Focus on new findings, methods, evidence quality, limitations, and practical implications. Distinguish peer-reviewed research, preprints, announcements, and commentary when possible.',
        detailedOutputGuidance: 'For research items, include the finding, method or evidence base, limitations, and practical implication. Avoid overstating preliminary results.',
        conciseOutputGuidance: 'Keep bullets focused on the finding, evidence type, and why it matters. Mark preliminary or limited evidence when relevant.'
    },
    company: {
        id: 'company',
        name: 'Company Monitor',
        description: 'Monitor companies, products, partnerships, leadership, and risks.',
        topics: ['Apple', 'Microsoft', 'OpenAI'],
        outputFormat: 'detailed',
        enableAnalysisContext: true,
        templateType: 'detailed',
        promptGuidance: 'Focus on company actions, product releases, partnerships, financial signals, legal or regulatory risks, and competitive positioning. Prefer concrete developments over broad commentary.',
        detailedOutputGuidance: 'For each company item, explain the business impact, competitive positioning, and risks. Add follow-up questions when the next decision, release, filing, or regulatory step is unclear.',
        conciseOutputGuidance: 'Keep bullets focused on company action, business impact, and one risk or open question when useful.'
    },
    rss: {
        id: 'rss',
        name: 'RSS Digest',
        description: 'A compact digest optimized for user-provided RSS feeds.',
        topics: ['Technology', 'World News'],
        outputFormat: 'concise',
        enableAnalysisContext: false,
        templateType: 'minimal',
        promptGuidance: 'Create a compact digest of the most useful feed items. Avoid repetition, group related items when sensible, and keep each bullet factual and source-backed.',
        detailedOutputGuidance: 'Even in detailed mode, keep RSS output compact. Do not add long analysis sections unless the source item clearly supports them.',
        conciseOutputGuidance: 'Return concise source-backed bullets only. Avoid separate "Why it matters", "Risks", or "Follow-up questions" sections.'
    }
};

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

// Secret storage field mappings for API keys
export const SECRET_FIELDS: Array<{ key: keyof DailyNewsSettings; secretId: string }> = [
    { key: 'googleSearchApiKey', secretId: 'daily-news-google-search-api-key' },
    { key: 'geminiApiKey',       secretId: 'daily-news-gemini-api-key' },
    { key: 'perplexityApiKey',   secretId: 'daily-news-perplexity-api-key' },
    { key: 'openaiApiKey',       secretId: 'daily-news-openai-api-key' },
    { key: 'grokApiKey',         secretId: 'daily-news-grok-api-key' },
    { key: 'anthropicApiKey',    secretId: 'daily-news-anthropic-api-key' },
    { key: 'openrouterApiKey',   secretId: 'daily-news-openrouter-api-key' },
];

// Language display names for the dropdown
export const LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'fr': 'Français (French)',
    'de': 'Deutsch (German)',
    'es': 'Español (Spanish)',
    'it': 'Italiano (Italian)',
    'zh': '中文 (Chinese)',
};
