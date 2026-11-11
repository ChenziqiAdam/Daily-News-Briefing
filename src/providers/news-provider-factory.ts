import type { DailyNewsSettings } from '../types';
import type { BaseNewsProvider } from './base-news-provider';
import type { NewsRetriever } from './retrievers/base-retriever';
import type { ModelKind } from './native-response';
import { GoogleSearchRetriever } from './retrievers/google-search-retriever';
import { RSSRetriever } from './retrievers/rss-retriever';
import { PerplexitySearchRetriever } from './retrievers/perplexity-search-retriever';
import { SearchSummarizeCoordinator } from './coordinators/search-summarize-coordinator';
import { AgenticNewsProvider } from './agentic-news-provider';
import { StructuredSummarizer } from './structured-summarizer';
import { ModelClient } from './model-client';

/** Adding a model provider: extend ModelKind and ModelClient, then add its label here. */
const MODEL_LABELS: Record<ModelKind, string> = {
    gemini: 'Gemini', gpt: 'GPT', grok: 'Grok', claude: 'Claude', openrouter: 'OpenRouter', sonar: 'Sonar by Perplexity',
};
const SOURCE_LABELS: Record<DailyNewsSettings['newsSource'], string> = {
    google: 'Google Search', rss: 'RSS', perplexity: 'Perplexity Search',
};
const known = <T extends string>(table: Record<T, string>, key: string): key is T => Object.prototype.hasOwnProperty.call(table, key);

export class NewsProviderFactory {
    /** The model that writes the briefing in the selected pipeline. */
    private static modelKind(settings: DailyNewsSettings): ModelKind {
        return settings.pipelineMode === 'agentic' ? settings.agenticProvider : settings.summarizer;
    }

    /** Short provider key (e.g. 'rss-gemini', 'sonar') used in cache keys and tags. */
    static getProviderKey(settings: DailyNewsSettings): string {
        return settings.pipelineMode === 'agentic' ? settings.agenticProvider : `${settings.newsSource}-${settings.summarizer}`;
    }

    static createProvider(settings: DailyNewsSettings, saveSettingsCallback?: () => Promise<void>): BaseNewsProvider {
        const kind = this.modelKind(settings);
        if (!known(MODEL_LABELS, kind)) throw new Error(`Unknown AI provider: ${String(kind)}`);
        if (settings.pipelineMode === 'agentic') return new AgenticNewsProvider(settings, kind);

        const retriever: NewsRetriever = settings.newsSource === 'rss' ? new RSSRetriever(settings)
            : settings.newsSource === 'perplexity' ? new PerplexitySearchRetriever(settings)
            : new GoogleSearchRetriever(settings, saveSettingsCallback);
        return new SearchSummarizeCoordinator(settings, retriever, new StructuredSummarizer(settings, kind), this.pipelineLabel(settings));
    }

    static validateProviderConfig(settings: DailyNewsSettings): boolean {
        const kind = this.modelKind(settings);
        if (!known(MODEL_LABELS, kind) || !new ModelClient(settings, kind).configured) return false;
        if (settings.pipelineMode === 'agentic') return true;
        if (settings.newsSource === 'rss') return !!(settings.rssFeeds && settings.rssFeeds.length > 0);
        if (settings.newsSource === 'perplexity') return !!settings.perplexityApiKey;
        return !!(settings.googleSearchApiKey && settings.googleSearchEngineId);
    }

    static getModelName(settings: DailyNewsSettings): string | null {
        const kind = this.modelKind(settings);
        return known(MODEL_LABELS, kind) ? new ModelClient(settings, kind).model : null;
    }

    private static pipelineLabel(settings: DailyNewsSettings): string {
        const kind = this.modelKind(settings);
        if (!known(MODEL_LABELS, kind)) return 'Unknown Provider';
        if (settings.pipelineMode === 'agentic') return kind === 'sonar' ? MODEL_LABELS.sonar : `${MODEL_LABELS[kind]} (Agentic Search)`;
        return `${SOURCE_LABELS[settings.newsSource] ?? SOURCE_LABELS.google} + ${MODEL_LABELS[kind]} Summarizer`;
    }

    static getProviderName(settings: DailyNewsSettings): string {
        const name = this.pipelineLabel(settings);
        const modelName = this.getModelName(settings);
        return modelName ? `${name} · ${modelName}` : name;
    }
}
