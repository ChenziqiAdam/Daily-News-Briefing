import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/types';
import { dateInWindow, extractJson, normalizeSources, parseBriefing, renderBriefing, safeUrl } from '../src/briefing';
import { localDate, scheduleIsDue, topicCacheKey, migrateModelDefaults, newsNoteDate, topicTag, mapLimit } from '../src/runtime-utils';
import { parseFeed } from '../src/providers/retrievers/feed-parser';
import { topicScore } from '../src/providers/retrievers/rss-retriever';
import { TemplateEngine } from '../src/template/template-engine';
import { migrateSettings } from '../src/settings-migration';
import { STRINGS, strings } from '../src/i18n';
import type { TemplateData } from '../src/types';
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

test('RSS, RDF and Atom feeds parse into one shape without Node built-ins', () => {
    const rss = parseFeed(`<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Feed &amp; Co</title>
        <item><title><![CDATA[AI <b>chips</b>]]></title><link>https://example.com/a?x=1&amp;y=2</link><guid isPermaLink="false">id-1</guid>
        <pubDate>Sun, 18 Oct 2026 03:00:00 GMT</pubDate><description>&lt;p&gt;Body text&lt;/p&gt;</description><category>Tech</category><category domain="x">AI</category></item>
        <item><title>Guid only</title><guid>https://example.com/b</guid><dc:date>2026-10-18T02:00:00Z</dc:date></item>
    </channel></rss>`);
    assert.equal(rss.title, 'Feed & Co');
    assert.deepEqual(rss.items[0], { title: 'AI <b>chips</b>', link: 'https://example.com/a?x=1&y=2', published: 'Sun, 18 Oct 2026 03:00:00 GMT', content: '<p>Body text</p>', categories: ['Tech', 'AI'] });
    assert.equal(rss.items[1].link, 'https://example.com/b');
    assert.equal(rss.items[1].published, '2026-10-18T02:00:00Z');
    const atom = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><title type="text">Atom</title>
        <entry><title type="html">One</title><link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/one"/>
        <updated>2026-10-18T01:00:00Z</updated><summary type="html">Summary</summary><category term="News"/></entry></feed>`);
    assert.deepEqual(atom.items, [{ title: 'One', link: 'https://example.com/one', published: '2026-10-18T01:00:00Z', content: 'Summary', categories: ['News'] }]);
    const rdf = parseFeed(`<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>RDF</title></channel><item><title>R</title><link>https://example.com/r</link></item></rdf:RDF>`);
    assert.equal(rdf.items[0].link, 'https://example.com/r');
    assert.equal(parseFeed('<rss><channel><title>Empty</title></channel></rss>').items.length, 0);
    assert.throws(() => parseFeed('<html><body>Not a feed</body></html>'), /Not an RSS or Atom feed/);
});

test('templates insert values literally and validate the placeholders they render', () => {
    const data = { topics: 'Costs $& and $\' and {{DATE}}', date: '2026-10-18', metadataDatetime: '2026-10-18 08:00' } as TemplateData;
    assert.equal(TemplateEngine.renderTemplate('custom', '{{DATE}}: {{TOPICS}} {{METADATA_DATETIME}} {{UNKNOWN_ONE}}', data),
        "2026-10-18: Costs $& and $' and {{DATE}} 2026-10-18 08:00 {{UNKNOWN_ONE}}");
    assert.equal(TemplateEngine.validateTemplate('{{TOPICS}} {{METADATA_DATETIME}}').valid, true);
    assert.deepEqual(TemplateEngine.validateTemplate('{{TOPICS}} {{METADATA_DATE}}').errors, ['Unknown placeholder: {{METADATA_DATE}}']);
    const documented = TemplateEngine.getPlaceholderInfo().flatMap(group => group.placeholders.map(p => p.placeholder));
    assert.deepEqual([...documented].sort(), [...TemplateEngine.getValidPlaceholders()].sort());
});

test('topic tags keep non-Latin letters and retry notes are recognized for cleanup', () => {
    assert.equal(topicTag('World News'), 'world-news');
    assert.equal(topicTag('人工智能'), '人工智能');
    assert.equal(topicTag(' C++ & AI! '), 'c-ai');
    assert.equal(topicTag('!!!'), '');
    assert.equal(newsNoteDate('Daily News - 2026-10-18.md'), '2026-10-18');
    assert.equal(newsNoteDate('Daily News - 2026-10-18 - Retry 1760760000000.md'), '2026-10-18');
    assert.equal(newsNoteDate('Daily News - 2026-10-18 notes.md'), undefined);
    assert.equal(newsNoteDate('My Daily News - 2026-10-18.md'), undefined);
});

test('model JSON is accepted with code fences or surrounding prose, and garbage is rejected', () => {
    assert.equal(parseBriefing('```json\n' + payload() + '\n```', sources(), settings(), undefined, now).status, 'success');
    assert.equal(parseBriefing('Here is the briefing:\n' + payload() + '\nLet me know if you need more.', sources(), settings(), undefined, now).items.length, 1);
    assert.deepEqual(extractJson(' {"items":[]} '), { items: [] });
    assert.throws(() => extractJson('No news today.'), /valid JSON/);
    assert.throws(() => extractJson('{"items": [truncated'), /valid JSON/);
});

test('RSS relevance ignores generic words, matches word prefixes and ranks phrases first', () => {
    const item = (title: string, content = '', categories: string[] = []) => ({ title, content, categories });
    assert.equal(topicScore(item('Anything at all'), ''), 1);
    assert.equal(topicScore(item('Breaking news from the stadium'), 'World News'), 0);
    assert.equal(topicScore(item('World leaders meet'), 'World News'), 2);
    assert.equal(topicScore(item('BBC World News tonight'), 'World News'), 3);
    assert.equal(topicScore(item('New chips announced'), 'chip'), 3);
    assert.equal(topicScore(item('Chip makers and AI rivals'), 'AI chip'), 2);
    assert.equal(topicScore(item('A fresh start'), 'art'), 0);
    assert.equal(topicScore(item('Markets', 'Stocks fell'), 'stock market'), 2);
    assert.equal(topicScore(item('Stocks fell'), 'stock exchange'), 1);
    assert.equal(topicScore(item('Untitled', '', ['Technology']), 'technology'), 3);
    assert.equal(topicScore(item('最新人工智能芯片发布'), '人工智能'), 3);
    assert.equal(topicScore(item('Latest news'), 'news'), 3);
});

test('bounded concurrency keeps input order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapLimit([30, 5, 20, 1, 10], 2, async (ms, index) => {
        peak = Math.max(peak, ++active);
        await new Promise(resolve => setTimeout(resolve, ms));
        active--;
        return `${index}:${ms}`;
    });
    assert.deepEqual(results, ['0:30', '1:5', '2:20', '3:1', '4:10']);
    assert.equal(peak, 2);
    assert.deepEqual(await mapLimit([], 3, async () => 1), []);
});

test('settings migration maps legacy providers, drops obsolete keys and runs once', () => {
    const migrate = (loaded: Record<string, unknown>) => {
        const s = Object.assign(settings(), loaded);
        return { s, changed: migrateSettings(s, loaded) };
    };
    const agentic = migrate({ apiProvider: 'sonar' });
    assert.equal(agentic.changed, true);
    assert.deepEqual([agentic.s.pipelineMode, agentic.s.agenticProvider], ['agentic', 'sonar']);
    const modular = migrate({ apiProvider: 'rss-claude' });
    assert.deepEqual([modular.s.pipelineMode, modular.s.newsSource, modular.s.summarizer], ['modular', 'rss', 'claude']);
    const oldest = migrate({ apiProvider: 'google' });
    assert.deepEqual([oldest.s.newsSource, oldest.s.summarizer, oldest.s.apiProvider], ['google', 'gemini', 'google-gemini']);
    const legacy = migrate({ pipelineMode: 'agentic', modelDefaultsVersion: 1, includeDatetime: false, includeTime: true, minContentLength: 80 });
    assert.equal(legacy.changed, true);
    assert.equal(legacy.s.includeDatetime, true);
    assert.equal('includeTime' in legacy.s || 'minContentLength' in legacy.s, false);
    // A second load of the saved result changes nothing.
    assert.equal(migrateSettings(legacy.s, JSON.parse(JSON.stringify(legacy.s))), false);
    assert.equal(migrateSettings(settings(), null), false);
});

test('every language provides every note string and unknown codes fall back to English', () => {
    const keys = (value: object) => Object.keys(value).sort();
    for (const [code, text] of Object.entries(STRINGS)) {
        assert.deepEqual(keys(text), keys(STRINGS.en), code);
        assert.deepEqual(keys(text.warnings), keys(STRINGS.en.warnings), code);
        for (const value of [...Object.values(text), ...Object.values(text.warnings)]) {
            if (typeof value === 'string') assert.ok(value.trim().length > 0, code);
        }
    }
    assert.equal(strings('xx'), STRINGS.en);
    assert.equal(strings('constructor'), STRINGS.en);
    const result = parseBriefing(payload(), sources('2026-10-18'), settings(), undefined, now);
    assert.match(renderBriefing(result, { ...settings(), language: 'de' }), /Qualitätshinweise: Einige Quellen geben nur ein Datum/);
});
