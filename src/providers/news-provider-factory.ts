import type { DailyNewsSettings } from '../types';
import {
    GEMINI_MODEL_NAME,
    GEMINI_SUMMARY_MODEL_NAME,
    GPT_MODEL_NAME,
    PERPLEXITY_MODEL_NAME,
    GROK_MODEL_NAME,
    CLAUDE_MODEL_NAME,
    OPENROUTER_DEFAULT_MODEL
} from '../constants';
import { BaseNewsProvider } from './base-news-provider';
import { GoogleSearchRetriever } from './retrievers/google-search-retriever';
import { RSSRetriever } from './retrievers/rss-retriever';
import { PerplexitySearchRetriever } from './retrievers/perplexity-search-retriever';
import { GeminiSummarizer } from './summarizers/gemini-summarizer';
import { GptSummarizer } from './summarizers/gpt-summarizer';
import { GrokSummarizer } from './summarizers/grok-summarizer';
import { ClaudeSummarizer } from './summarizers/claude-summarizer';
import { OpenRouterSummarizer } from './summarizers/openrouter-summarizer';
import { GptAgenticProvider } from './agentic/gpt-agentic-provider';
import { GrokAgenticProvider } from './agentic/grok-agentic-provider';
import { ClaudeAgenticProvider } from './agentic/claude-agentic-provider';
import { OpenRouterAgenticProvider } from './agentic/openrouter-agentic-provider';
import { PerplexityNewsProvider } from './agentic/perplexity-provider';
import { GeminiAgenticProvider } from './agentic/gemini-agentic-provider';
import { SearchSummarizeCoordinator } from './coordinators/search-summarize-coordinator';

export class NewsProviderFactory {
    /**
     * Returns a legacy-style provider key string (e.g. 'google-gemini', 'sonar')
     * used for cache key compatibility.
     */
    static getProviderKey(settings: DailyNewsSettings): string {
        if (settings.pipelineMode === 'agentic') {
            return settings.agenticProvider; // 'sonar' | 'gpt' | 'grok' | 'claude' | 'openrouter'
        }
        return `${settings.newsSource}-${settings.summarizer}`; // e.g. 'google-gemini', 'rss-gpt'
    }

    static createProvider(settings: DailyNewsSettings, saveSettingsCallback?: () => Promise<void>): BaseNewsProvider {
        if (settings.pipelineMode === 'agentic') {
            switch (settings.agenticProvider) {
                case 'sonar':
                    return new PerplexityNewsProvider(settings);
                case 'gpt':
                    return new GptAgenticProvider(settings);
                case 'grok':
                    return new GrokAgenticProvider(settings);
                case 'claude':
                    return new ClaudeAgenticProvider(settings);
                case 'openrouter':
                    return new OpenRouterAgenticProvider(settings);
                case 'gemini':
                    return new GeminiAgenticProvider(settings);
                default:
                    throw new Error(`Unknown agentic provider: ${settings.agenticProvider}`);
            }
        }

        // Modular mode — build retriever + summarizer
        let retriever;
        if (settings.newsSource === 'rss') {
            retriever = new RSSRetriever(settings);
        } else if (settings.newsSource === 'perplexity') {
            retriever = new PerplexitySearchRetriever(settings);
        } else {
            retriever = new GoogleSearchRetriever(settings, saveSettingsCallback);
        }

        const sourceLabel = settings.newsSource === 'rss' ? 'RSS'
            : settings.newsSource === 'perplexity' ? 'Perplexity Search'
            : 'Google Search';

        switch (settings.summarizer) {
            case 'gemini':
                return new SearchSummarizeCoordinator(settings, retriever, new GeminiSummarizer(settings), `${sourceLabel} + Gemini Summarizer`);
            case 'gpt':
                return new SearchSummarizeCoordinator(settings, retriever, new GptSummarizer(settings), `${sourceLabel} + GPT Summarizer`);
            case 'grok':
                return new SearchSummarizeCoordinator(settings, retriever, new GrokSummarizer(settings), `${sourceLabel} + Grok Summarizer`);
            case 'claude':
                return new SearchSummarizeCoordinator(settings, retriever, new ClaudeSummarizer(settings), `${sourceLabel} + Claude Summarizer`);
            case 'openrouter':
                return new SearchSummarizeCoordinator(settings, retriever, new OpenRouterSummarizer(settings), `${sourceLabel} + OpenRouter Summarizer`);
            default:
                throw new Error(`Unknown summarizer: ${settings.summarizer}`);
        }
    }

    static validateProviderConfig(settings: DailyNewsSettings): boolean {
        if (settings.pipelineMode === 'agentic') {
            switch (settings.agenticProvider) {
                case 'sonar':    return !!settings.perplexityApiKey;
                case 'gpt':      return !!settings.openaiApiKey;
                case 'grok':     return !!settings.grokApiKey;
                case 'claude':   return !!settings.anthropicApiKey;
                case 'openrouter': return !!settings.openrouterApiKey;
                case 'gemini':   return !!settings.geminiApiKey;
                default:         return false;
            }
        }

        // Validate news source
        let sourceValid: boolean;
        if (settings.newsSource === 'rss') {
            sourceValid = !!(settings.rssFeeds && settings.rssFeeds.length > 0);
        } else if (settings.newsSource === 'perplexity') {
            sourceValid = !!settings.perplexityApiKey;
        } else {
            sourceValid = !!(settings.googleSearchApiKey && settings.googleSearchEngineId);
        }

        if (!sourceValid) return false;

        // Validate summarizer
        switch (settings.summarizer) {
            case 'gemini':      return !!settings.geminiApiKey;
            case 'gpt':         return !!settings.openaiApiKey;
            case 'grok':        return !!settings.grokApiKey;
            case 'claude':      return !!settings.anthropicApiKey;
            case 'openrouter':  return !!settings.openrouterApiKey;
            default:            return false;
        }
    }

    static getModelName(settings: DailyNewsSettings): string | null {
        const provider = settings.pipelineMode === 'agentic' ? settings.agenticProvider : settings.summarizer;
        switch (provider) {
            case 'gemini':     return settings.geminiModel || (settings.pipelineMode === 'agentic' ? GEMINI_MODEL_NAME : GEMINI_SUMMARY_MODEL_NAME);
            case 'gpt':        return settings.gptModel || GPT_MODEL_NAME;
            case 'sonar':      return settings.perplexityModel || PERPLEXITY_MODEL_NAME;
            case 'grok':       return settings.grokModel || GROK_MODEL_NAME;
            case 'claude':     return settings.claudeModel || CLAUDE_MODEL_NAME;
            case 'openrouter': return settings.openrouterModel || OPENROUTER_DEFAULT_MODEL;
            default:           return null;
        }
    }

    static getProviderName(settings: DailyNewsSettings): string {
        let name: string;

        if (settings.pipelineMode === 'agentic') {
            switch (settings.agenticProvider) {
                case 'sonar':      name = 'Sonar by Perplexity'; break;
                case 'gpt':        name = 'GPT (Agentic Search)'; break;
                case 'grok':       name = 'Grok (Agentic Search)'; break;
                case 'claude':     name = 'Claude (Agentic Search)'; break;
                case 'openrouter': name = 'OpenRouter (Agentic Search)'; break;
                case 'gemini':     name = 'Gemini (Agentic Search)'; break;
                default:           return 'Unknown Agentic Provider';
            }
        } else {
            const sourceLabel = settings.newsSource === 'rss' ? 'RSS'
                : settings.newsSource === 'perplexity' ? 'Perplexity Search'
                : 'Google Search';
            switch (settings.summarizer) {
                case 'gemini':      name = `${sourceLabel} + Gemini Summarizer`; break;
                case 'gpt':         name = `${sourceLabel} + GPT Summarizer`; break;
                case 'grok':        name = `${sourceLabel} + Grok Summarizer`; break;
                case 'claude':      name = `${sourceLabel} + Claude Summarizer`; break;
                case 'openrouter':  name = `${sourceLabel} + OpenRouter Summarizer`; break;
                default:            return 'Unknown Provider';
            }
        }

        const modelName = this.getModelName(settings);
        return modelName ? `${name} · ${modelName}` : name;
    }
}
