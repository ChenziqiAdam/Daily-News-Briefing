import { normalizeSources, emptyUsage } from '../briefing';
import type { NewsSource, Usage } from '../briefing';
export const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const string = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
export interface ModelReply { text: string; sources: NewsSource[]; usage: Usage }
export type ModelKind = 'gpt' | 'gemini' | 'claude' | 'grok' | 'openrouter' | 'sonar';
export function nativeResponse(kind: ModelKind, raw: unknown): ModelReply {
    const r = record(raw);
    const sources: Omit<NewsSource, 'id'>[] = [];
    const add = (url: unknown, title: unknown, snippet: unknown = '', date?: unknown) => {
        sources.push({ url: string(url), title: string(title), snippet: string(snippet), publishedAt: string(date) || undefined, evidence: 'native' });
    };
    let text = '';
    const usage = emptyUsage();
    usage.requests = 1;
    const u = record(r.usage ?? r.usageMetadata ?? r.totalUsage);
    usage.inputTokens = number(u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount ?? u.inputTokens);
    usage.outputTokens = number(u.output_tokens ?? u.completion_tokens ?? u.candidatesTokenCount ?? u.outputTokens) + number(u.thoughtsTokenCount);
    if (kind === 'gpt') {
        if (r.status === 'incomplete' || r.status === 'failed') throw new Error('OpenAI response was incomplete; no partial briefing will be saved as success.');
        text = string(r.output_text);
        for (const value of list(r.output)) {
            const item = record(value);
            if (item.type === 'web_search_call' && item.status === 'completed') {
                usage.searchRequests++;
                for (const source of list(record(item.action).sources)) {
                    const s = record(source); add(s.url, s.title);
                }
            }
            for (const content of list(item.content)) {
                const block = record(content);
                if (!r.output_text && block.type === 'output_text') text += string(block.text);
                for (const annotation of list(block.annotations)) {
                    const a = record(annotation);
                    if (a.type === 'url_citation') add(a.url, a.title, string(block.text).slice(number(a.start_index), number(a.end_index)));
                }
            }
        }
    } else if (kind === 'gemini') {
        text = string(r.text);
        for (const candidate of list(r.candidates).slice(0, 1)) {
            const c = record(candidate);
            if (c.finishReason && c.finishReason !== 'STOP') throw new Error(`Gemini response stopped: ${string(c.finishReason)}`);
            const g = record(c.groundingMetadata);
            usage.searchRequests += list(g.webSearchQueries).length;
            const chunks = list(g.groundingChunks);
            for (let index = 0; index < chunks.length; index++) {
                const web = record(record(chunks[index]).web);
                const snippets = list(g.groundingSupports).filter(support => list(record(support).groundingChunkIndices).includes(index))
                    .map(support => string(record(record(support).segment).text)).join('\n');
                add(web.uri, web.title, snippets);
            }
        }
    } else if (kind === 'claude') {
        if (['max_tokens', 'pause_turn', 'refusal'].includes(string(r.stop_reason))) throw new Error(`Claude response stopped: ${string(r.stop_reason)}. Increase the output limit or try fewer items.`);
        usage.searchRequests = number(record(u.server_tool_use).web_search_requests);
        for (const content of list(r.content)) {
            const block = record(content);
            if (block.type === 'text') {
                text += string(block.text) + '\n';
                for (const citation of list(block.citations)) {
                    const c = record(citation);
                    if (c.type === 'web_search_result_location') add(c.url, c.title, c.cited_text);
                }
            } else if (block.type === 'web_search_tool_result') {
                if (!Array.isArray(block.content)) throw new Error(`Claude web search failed: ${string(record(block.content).error_code)}`);
                for (const value of block.content) { const source = record(value); add(source.url, source.title, '', source.page_age); }
                // Some API revisions omit tool usage counts; a successful result still proves retrieval.
                if (!usage.searchRequests) usage.searchRequests = 1;
            }
        }
    } else if (kind === 'grok') {
        if (r.finishReason && !['stop', 'tool-calls'].includes(string(r.finishReason))) throw new Error('Grok returned an incomplete response.');
        text = string(r.text);
        for (const value of list(r.sources)) {
            const source = record(value);
            if (source.sourceType === 'url') add(source.url, source.title);
        }
        for (const value of list(r.toolResults)) {
            const result = record(value);
            if (result.toolName === 'web_search') {
                usage.searchRequests++;
                for (const source of list(record(result.output).sources)) { const s = record(source); add(s.url, s.title, s.snippet); }
            }
        }
    } else {
        const choice = record(list(r.choices)[0]);
        if (choice.finish_reason && !['stop', 'end_turn'].includes(string(choice.finish_reason))) throw new Error('Provider returned an incomplete response.');
        const message = record(choice.message);
        text = string(message.content);
        for (const value of list(message.annotations)) {
            const annotation = record(value);
            const citation = record(annotation.url_citation);
            if (annotation.type === 'url_citation') add(citation.url, citation.title, citation.content);
        }
        for (const value of list(r.search_results)) { const source = record(value); add(source.url, source.title, source.snippet, source.date); }
        for (const url of list(r.citations)) add(url, url);
        usage.searchRequests = number(record(u.server_tool_use).web_search_requests ?? record(u.num_search_queries).total ?? u.num_search_queries);
    }
    return { text: text.trim(), sources: normalizeSources(sources), usage };
}
