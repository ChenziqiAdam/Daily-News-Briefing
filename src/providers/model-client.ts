import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import type { DailyNewsSettings } from '../types';
import { GEMINI_MODEL_NAME, GEMINI_SUMMARY_MODEL_NAME, GPT_MODEL_NAME, CLAUDE_MODEL_NAME, GROK_MODEL_NAME, OPENROUTER_DEFAULT_MODEL, OPENROUTER_API_URL, PERPLEXITY_MODEL_NAME, PERPLEXITY_API_URL } from '../constants';
import { nativeResponse } from './native-response';
import type { ModelKind, ModelReply } from './native-response';
import { requireOpenAISearch, requireGeminiSearch, requireOpenRouterSearch } from './search-evidence';
import { retryRequest, requestJson } from './request-policy';
import { timeWindow } from '../briefing';

export class ModelClient {
    constructor(private s: DailyNewsSettings, readonly kind: ModelKind) {}
    get model(): string {
        switch (this.kind) {
            case 'gpt': return this.s.gptModel || GPT_MODEL_NAME;
            case 'gemini': return this.s.geminiModel || (this.s.pipelineMode === 'agentic' ? GEMINI_MODEL_NAME : GEMINI_SUMMARY_MODEL_NAME);
            case 'claude': return this.s.claudeModel || CLAUDE_MODEL_NAME;
            case 'grok': return this.s.grokModel || GROK_MODEL_NAME;
            case 'openrouter': return this.s.openrouterModel || OPENROUTER_DEFAULT_MODEL;
            case 'sonar': return this.s.perplexityModel || PERPLEXITY_MODEL_NAME;
        }
    }
    get configured(): boolean {
        return !!this.key;
    }
    private get key(): string {
        return ({ gpt: this.s.openaiApiKey, gemini: this.s.geminiApiKey, claude: this.s.anthropicApiKey, grok: this.s.grokApiKey, openrouter: this.s.openrouterApiKey, sonar: this.s.perplexityApiKey })[this.kind];
    }
    async generate(prompt: string, search = false): Promise<ModelReply> {
        if (!this.configured) throw new Error(`Missing ${this.kind} API key.`);
        const timeout = Math.max(10, Math.min(300, this.s.requestTimeoutSeconds)) * 1000;
        const maxTokens = Math.max(512, Math.min(32768, this.s.maxOutputTokens));
        const searches = Math.max(1, Math.min(10, this.s.maxSearchCalls));
        return retryRequest(async () => {
            let raw: unknown;
            if (this.kind === 'gpt') {
                const client = new OpenAI({ apiKey: this.key, dangerouslyAllowBrowser: true, timeout, maxRetries: 0 });
                const response = await client.responses.create({ model: this.model, input: prompt, max_output_tokens: maxTokens,
                    ...(search ? { tools: [{ type: 'web_search' as const }], tool_choice: 'required' as const, include: ['web_search_call.action.sources' as const], max_tool_calls: searches } : {}),
                });
                if (search) requireOpenAISearch(response);
                raw = response;
            } else if (this.kind === 'gemini') {
                const client = new GoogleGenAI({ apiKey: this.key });
                const response = await client.models.generateContent({ model: this.model, contents: prompt,
                    config: { maxOutputTokens: maxTokens, httpOptions: { timeout }, ...(search ? { tools: [{ googleSearch: {} }] } : { responseMimeType: 'application/json' }) },
                });
                if (search) requireGeminiSearch(response);
                raw = response;
            } else if (this.kind === 'claude') {
                const client = new Anthropic({ apiKey: this.key, dangerouslyAllowBrowser: true, timeout, maxRetries: 0 });
                raw = await client.messages.create({ model: this.model, max_tokens: maxTokens,
                    ...(search ? { tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: searches }], tool_choice: { type: 'any' as const } } : {}),
                    messages: [{ role: 'user', content: prompt }],
                });
            } else if (this.kind === 'grok') {
                const client = createXai({ apiKey: this.key });
                raw = await generateText({ model: client.responses(this.model), prompt, maxOutputTokens: maxTokens, maxRetries: 0,
                    timeout, ...(search ? { tools: { web_search: client.tools.webSearch() }, toolChoice: 'required' as const } : {}),
                });
            } else if (this.kind === 'openrouter') {
                const client = new OpenAI({ apiKey: this.key, baseURL: OPENROUTER_API_URL, dangerouslyAllowBrowser: true, timeout, maxRetries: 0,
                    defaultHeaders: { 'HTTP-Referer': 'https://github.com/ChenziqiAdam/Daily-News-Briefing', 'X-Title': 'Obsidian Daily News Briefing' } });
                const response = await client.chat.completions.create({ model: this.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens,
                    ...(search ? { tools: [{ type: 'openrouter:web_search', parameters: { max_uses: searches } }] as unknown as OpenAI.Chat.Completions.ChatCompletionTool[], tool_choice: 'required' as const, ...{ max_tool_calls: searches } } : {}),
                });
                if (search) requireOpenRouterSearch(response);
                raw = response;
            } else {
                const { start, end } = timeWindow(this.s.dateRange);
                const date = (value: Date) => `${value.getUTCMonth() + 1}/${value.getUTCDate()}/${value.getUTCFullYear()}`;
                raw = await requestJson({ url: PERPLEXITY_API_URL, method: 'POST',
                    headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: this.model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }],
                        search_after_date_filter: date(start), search_before_date_filter: date(new Date(end.getTime() + 86400000)),
                    }),
                }, { ...this.s, requestRetries: 0 });
            }
            const result = nativeResponse(this.kind, raw);
            if (!result.text) throw new Error('The model returned an empty response.');
            if (search && !result.sources.length && !result.usage.searchRequests) throw new Error('No native search evidence was returned. Please check search access and quotas.');
            return result;
        }, Math.max(0, Math.min(2, this.s.requestRetries)));
    }
}
