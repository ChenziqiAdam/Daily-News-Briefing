# Regression tests

Run `npm test` for offline checks, and `npm run build` for production type checking
and bundling. The tests cover release metadata, source/date/schema rules, rendering,
model migration, settings migration, translations, feed parsing, RSS relevance,
templates, cache invalidation, native response parsing and the packaged host
HTTP transport/retry policy. `tests/obsidian-stub.ts` stands in for the Obsidian API.

This is a rebuilt core suite after the previous test directory was deleted. It does
not reproduce all earlier tests: provider SDK request integration, persisted cache,
generation overlap, retry note preservation and scheduler integration still need
additional regression coverage. Offline checks do not replace real-vault acceptance.

`npm run test:live-rss` is an optional real-network smoke test. It needs no API keys
and does not call AI models or write to a vault. It is not run by release CI.

All files here are maintained test sources. No temporary Developer acceptance
plugin or test ribbon is included.
