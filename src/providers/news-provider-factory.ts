import type { DailyNewsSettings } from '../types';
import { BaseNewsProvider } from './base-news-provider';
import { GoogleSearchRetriever } from './retrievers/google-search-retriever';
import { RSSRetriever } from './retrievers/rss-retriever';
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
        const retriever = settings.newsSource === 'rss'
            ? new RSSRetriever(settings)
            : new GoogleSearchRetriever(settings, saveSettingsCallback);

        const sourceLabel = settings.newsSource === 'rss' ? 'RSS' : 'Google Search';

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
        const sourceValid = settings.newsSource === 'rss'
            ? !!(settings.rssFeeds && settings.rssFeeds.length > 0)
            : !!(settings.googleSearchApiKey && settings.googleSearchEngineId);

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

    static getProviderName(settings: DailyNewsSettings): string {
        if (settings.pipelineMode === 'agentic') {
            switch (settings.agenticProvider) {
                case 'sonar':      return 'Sonar by Perplexity';
                case 'gpt':        return 'GPT (Agentic Search)';
                case 'grok':       return 'Grok (Agentic Search)';
                case 'claude':     return 'Claude (Agentic Search)';
                case 'openrouter': return 'OpenRouter (Agentic Search)';
                case 'gemini':     return 'Gemini (Agentic Search)';
                default:           return 'Unknown Agentic Provider';
            }
        }

        const sourceLabel = settings.newsSource === 'rss' ? 'RSS' : 'Google Search';
        switch (settings.summarizer) {
            case 'gemini':      return `${sourceLabel} + Gemini Summarizer`;
            case 'gpt':         return `${sourceLabel} + GPT Summarizer`;
            case 'grok':        return `${sourceLabel} + Grok Summarizer`;
            case 'claude':      return `${sourceLabel} + Claude Summarizer`;
            case 'openrouter':  return `${sourceLabel} + OpenRouter Summarizer`;
            default:            return 'Unknown Provider';
        }
    }
}
