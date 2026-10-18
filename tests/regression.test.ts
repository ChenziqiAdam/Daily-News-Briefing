import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/types';
import { dateInWindow, normalizeSources, parseBriefing, renderBriefing, safeUrl } from '../src/briefing';
import { localDate, scheduleIsDue, topicCacheKey, migrateModelDefaults } from '../src/runtime-utils';
import { nativeResponse } from '../src/providers/native-response';
import { requireGeminiSearch, requireOpenAISearch, requireOpenRouterSearch } from '../src/providers/search-evidence';

const now = new Date('2026-10-18T04:00:00Z');
const settings = () => structuredClone(DEFAULT_SETTINGS);
const sources = (date: string | undefined = '2026-10-18T03:00:00Z') => normalizeSources([
    { url: 'https://example.com/news', title: 'Source', snippet: 'Evidence', publishedAt: date, evidence: 'retrieved' },
]);
const payload = (extra = {}) => JSON.stringify({ items: [{ title: 'News', summary: 'Facts', sourceIds: ['S1'], ...extra }] });

test('local calendar dates and missed schedule checks agree', () => {
    const local = new Date(2026, 9, 18, 9, 0);
    assert.equal(localDate(local), '2026-10-18');
    assert.equal(localDate(new Date(2026, 10, 1, 0, 1)), '2026-11-01');
    assert.equal(scheduleIsDue('08:00', local), true);
    assert.equal(scheduleIsDue('10:00', local), false);
    assert.equal(scheduleIsDue('25:00', local), false);
});

test('cache invalidates changed content settings but never includes credentials', () => {
    const s = settings();
    const key = topicCacheKey('2026-10-18', 'gemini', 'AI', s);
    s.geminiApiKey = 'private-test-value';
    assert.equal(topicCacheKey('2026-10-18', 'gemini', 'AI', s), key);
    for (const change of [{ language: 'zh' }, { includeUndatedNews: true }, { geminiModel: 'custom' }, { dateRange: 'w1' }]) {
        assert.notEqual(topicCacheKey('2026-10-18', 'gemini', 'AI', { ...s, ...change }), key);
    }
});

test('model migration preserves custom choices and runs once', () => {
    const s = settings();
    s.geminiModel = 'gemini-2.5-flash';
    s.gptModel = 'custom-model';
    assert.equal(migrateModelDefaults(s, 0), true);
    assert.equal(s.geminiModel, '');
    assert.equal(s.gptModel, 'custom-model');
    s.geminiModel = 'gemini-2.5-flash';
    assert.equal(migrateModelDefaults(s, 1), false);
    assert.equal(s.geminiModel, 'gemini-2.5-flash');
});

test('URL rules reject unsafe schemes and credentials and deduplicate tracking URLs', () => {
    for (const url of ['javascript:alert(1)', 'file:///tmp/file', 'https://user:password@example.com/']) assert.equal(safeUrl(url), undefined);
    const normalized = normalizeSources([
        { url: 'https://example.com/news?utm_source=test#section', title: 'A', snippet: '', evidence: 'native' },
        { url: 'https://example.com/news', title: 'B', snippet: 'Evidence', evidence: 'native' },
    ]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].url, 'https://example.com/news');
    assert.equal(normalized[0].snippet.trim(), 'Evidence');
});

test('date window excludes old, future and invalid dates and preserves unknown status', () => {
    assert.equal(dateInWindow('2026-10-18T03:00:00Z', 'd1', now), true);
    assert.equal(dateInWindow('2026-10-15T03:00:00Z', 'd1', now), false);
    assert.equal(dateInWindow('2026-10-19T03:00:00Z', 'd1', now), false);
    assert.equal(dateInWindow('2026-02-30', 'd1', now), undefined);
    assert.equal(dateInWindow(undefined, 'd1', now), undefined);
});

test('schema accepts null optional analysis but rejects malformed payloads', () => {
    assert.equal(parseBriefing(payload({ analysis: null }), sources(), settings(), undefined, now).status, 'success');
    for (const value of ['not JSON', '{"items":[{}]}', payload({ analysis: 42 })]) {
        assert.throws(() => parseBriefing(value, sources(), settings(), undefined, now));
    }
});

test('one invented source invalidates an otherwise sourced item', () => {
    const result = parseBriefing(payload({ sourceIds: ['S1', 'S99'] }), sources(), settings(), undefined, now);
    assert.equal(result.status, 'empty');
    assert.deepEqual(result.warnings, ['unverified_source']);
});

test('new model-reported dates cannot launder stale source metadata', () => {
    const result = parseBriefing(payload({ publishedAt: now.toISOString() }), sources('2026-10-01T00:00:00Z'), settings(), undefined, now);
    assert.equal(result.status, 'empty');
    assert.ok(result.warnings.includes('outside_window'));
});

test('undated items require explicit opt-in and carry a warning', () => {
    const undated = sources().map(source => ({ ...source, publishedAt: undefined }));
    assert.equal(parseBriefing(payload(), undated, settings(), undefined, now).status, 'empty');
    const result = parseBriefing(payload(), undated, { ...settings(), includeUndatedNews: true }, undefined, now);
    assert.equal(result.status, 'success');
    assert.equal(result.items[0].dateEvidence, 'unknown');
    assert.ok(result.warnings.includes('unknown_date'));
});

test('rendering uses trusted links and escapes model HTML and Markdown', () => {
    const s = { ...settings(), enableAnalysisContext: true, language: 'zh' };
    const result = parseBriefing(payload({ title: '<script>evil</script>', summary: '[fake](https://evil.example)', analysis: 'Interpretation' }), sources(), s, undefined, now);
    const markdown = renderBriefing(result, s);
    assert.ok(markdown.includes('](<https://example.com/news>)'));
    assert.ok(!markdown.includes('https://evil.example'));
    assert.ok(!markdown.includes('<script>'));
    assert.ok(markdown.includes('AI 分析'));
});

test('search guards reject text-only responses', () => {
    assert.throws(() => requireOpenAISearch({ output: [] }));
    assert.throws(() => requireGeminiSearch({ candidates: [] }));
    assert.throws(() => requireOpenRouterSearch({ choices: [] }));
    assert.doesNotThrow(() => requireOpenAISearch({ output: [{ type: 'web_search_call', status: 'completed' }] }));
    assert.doesNotThrow(() => requireGeminiSearch({ candidates: [{ groundingMetadata: { webSearchQueries: ['AI'] } }] }));
    assert.doesNotThrow(() => requireOpenRouterSearch({ usage: { server_tool_use: { web_search_requests: 1 } } }));
});

for (const [kind, raw] of [
    ['gpt', { status: 'incomplete' }],
    ['gemini', { candidates: [{ finishReason: 'MAX_TOKENS' }] }],
    ['claude', { stop_reason: 'max_tokens' }],
    ['grok', { finishReason: 'length' }],
    ['openrouter', { choices: [{ finish_reason: 'length' }] }],
    ['sonar', { choices: [{ finish_reason: 'length' }] }],
] as const) {
    test(`${kind} rejects incomplete output`, () => assert.throws(() => nativeResponse(kind, raw)));
}

test('Gemini native chunks retain grounding support and reported usage', () => {
    const reply = nativeResponse('gemini', { text: 'News', usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 }, candidates: [{ finishReason: 'STOP', groundingMetadata: {
        webSearchQueries: ['AI'], groundingChunks: [{ web: { uri: 'https://example.com/', title: 'Source' } }],
        groundingSupports: [{ groundingChunkIndices: [0], segment: { text: 'Supported fact' } }],
    } }] });
    assert.equal(reply.sources[0].snippet, 'Supported fact');
    assert.equal(reply.usage.searchRequests, 1);
    assert.equal(reply.usage.inputTokens, 10);
});

test('OpenAI extracts both annotations and complete search sources', () => {
    const reply = nativeResponse('gpt', { output_text: 'News', output: [
        { type: 'web_search_call', status: 'completed', action: { sources: [{ url: 'https://example.com/a', title: 'A' }] } },
        { content: [{ type: 'output_text', text: 'News', annotations: [{ type: 'url_citation', url: 'https://example.com/b', title: 'B' }] }] },
    ] });
    assert.equal(reply.sources.length, 2);
    assert.equal(reply.usage.searchRequests, 1);
});
