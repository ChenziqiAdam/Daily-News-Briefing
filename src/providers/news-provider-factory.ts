import type { DailyNewsSettings } from '../types';
import { BaseNewsProvider } from './base-news-provider';
import { GoogleSearchRetriever } from './retrievers/google-search-retriever';
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
import { SearchSummarizeCoordinator } from './coordinators/search-summarize-coordinator';

export class NewsProviderFactory {
    static createProvider(settings: DailyNewsSettings): BaseNewsProvider {
        switch (settings.apiProvider) {
            case 'google-gemini':
                return new SearchSummarizeCoordinator(
                    settings,
                    new GoogleSearchRetriever(settings),
                    new GeminiSummarizer(settings),
                    'Google Search + Gemini Summarizer'
                );
            case 'google-gpt':
                return new SearchSummarizeCoordinator(
                    settings,
                    new GoogleSearchRetriever(settings),
                    new GptSummarizer(settings),
                    'Google Search + GPT Summarizer'
                );
            case 'google-grok':
                return new SearchSummarizeCoordinator(
                    settings,
                    new GoogleSearchRetriever(settings),
                    new GrokSummarizer(settings),
                    'Google Search + Grok Summarizer'
                );
            case 'google-claude':
                return new SearchSummarizeCoordinator(
                    settings,
                    new GoogleSearchRetriever(settings),
                    new ClaudeSummarizer(settings),
                    'Google Search + Claude Summarizer'
                );
            case 'google-openrouter':
                return new SearchSummarizeCoordinator(
                    settings,
                    new GoogleSearchRetriever(settings),
                    new OpenRouterSummarizer(settings),
                    'Google Search + OpenRouter Summarizer'
                );
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
            default:
                throw new Error(`Unknown API provider: ${settings.apiProvider}`);
        }
    }

    static validateProviderConfig(settings: DailyNewsSettings): boolean {
        switch (settings.apiProvider) {
            case 'google-gemini':
                return !!(settings.googleSearchApiKey && settings.googleSearchEngineId && settings.geminiApiKey);
            case 'google-gpt':
                return !!(settings.googleSearchApiKey && settings.googleSearchEngineId && settings.openaiApiKey);
            case 'google-grok':
                return !!(settings.googleSearchApiKey && settings.googleSearchEngineId && settings.grokApiKey);
            case 'google-claude':
                return !!(settings.googleSearchApiKey && settings.googleSearchEngineId && settings.anthropicApiKey);
            case 'google-openrouter':
                return !!(settings.googleSearchApiKey && settings.googleSearchEngineId && settings.openrouterApiKey);
            case 'sonar':
                return !!settings.perplexityApiKey;
            case 'gpt':
                return !!settings.openaiApiKey;
            case 'grok':
                return !!settings.grokApiKey;
            case 'claude':
                return !!settings.anthropicApiKey;
            case 'openrouter':
                return !!settings.openrouterApiKey;
            default:
                return false;
        }
    }

    static getProviderName(settings: DailyNewsSettings): string {
        switch (settings.apiProvider) {
            case 'google-gemini':
                return 'Google Search + Gemini Summarizer';
            case 'google-gpt':
                return 'Google Search + GPT Summarizer';
            case 'google-grok':
                return 'Google Search + Grok Summarizer';
            case 'google-claude':
                return 'Google Search + Claude Summarizer';
            case 'google-openrouter':
                return 'Google Search + OpenRouter Summarizer';
            case 'sonar':
                return 'Sonar by Perplexity';
            case 'gpt':
                return 'GPT (Agentic Search)';
            case 'grok':
                return 'Grok (Agentic Search)';
            case 'claude':
                return 'Claude (Agentic Search)';
            case 'openrouter':
                return 'OpenRouter (Agentic Search)';
            default:
                return 'Unknown Provider';
        }
    }
}