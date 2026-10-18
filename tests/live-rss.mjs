// Optional real network smoke test: no keys, model calls or vault writes.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'daily-news-live-'));
try {
    const outfile = join(directory, 'live.mjs');
    await build({
        stdin: { contents: `
            import assert from 'node:assert/strict';
            import { RSSRetriever } from './src/providers/retrievers/rss-retriever';
            import { DEFAULT_SETTINGS } from './src/types';
            const settings = { ...structuredClone(DEFAULT_SETTINGS), rssFeeds: ['https://hnrss.org/frontpage'],
                dateRange: 'w1', resultsPerTopic: 3, requestTimeoutSeconds: 20, requestRetries: 0, includeUndatedNews: false };
            const retriever = new RSSRetriever(settings);
            const items = await retriever.fetchNews('');
            assert.ok(items.length > 0 && items.length <= settings.resultsPerTopic);
            for (const item of items) {
                assert.match(item.link, /^https?:\\/\\//);
                const published = Date.parse(item.publishedTime);
                assert.ok(published <= Date.now() && published >= Date.now() - 7 * 86400000);
            }
            assert.equal((await retriever.fetchNews('dailynewsnonexistenttopic938271')).length, 0);
            console.log('Live RSS passed:', items.length, 'recent items');
        `, resolveDir: resolve('.'), loader: 'ts' },
        outfile, bundle: true, platform: 'node', format: 'esm',
        plugins: [{ name: 'node-live-http', setup(build) {
            build.onResolve({ filter: /^obsidian$/ }, () => ({ path: resolve('tests/live-obsidian-http.ts') }));
        } }],
        banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    });
    await import(pathToFileURL(outfile).href);
} finally { await rm(directory, { recursive: true, force: true }); }
