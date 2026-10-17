# Daily News Briefing for Obsidian

> [Official Website](https://chenziqiadam.github.io/Daily-News-Briefing/) | [Full Documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/index.html)

**AI-powered daily news summaries delivered automatically to your Obsidian vault.**

## Features

- **Source-backed news**: Native citations, validated structured output, publication-date filtering, and separate AI analysis
- **11 AI Pipelines + RSS**: Google, Anthropic, OpenAI, Grok, Perplexity, OpenRouter, RSS Retriever
- **6 Briefing Presets**: Morning Brief, Market Watch, AI/Tech Tracker, Research Digest, Company Monitor, RSS Digest
- **Preset-Aware Output**: Adds use-case-specific context like why it matters, risks, watchlists, methods, and follow-up questions
- **Auto-Scheduled**: Wake up to fresh news every day
- **Custom Topics**: Track exactly what matters to you
- **6 Languages**: English, French, German, Spanish, Italian, Chinese
- **Flexible Templates**: 5 presets + custom templates with 25 placeholders
- **One-Click Access**: Sidebar button for instant generation
- **Auto-Organization**: Monthly subfolders keep your archive clean and organized

## Quick Start

1. **Install** from Obsidian Community Plugins
2. **Choose AI Provider** (for free summaries, choose RSS + Gemini; see model access below)
3. **Add API Key(s)** in settings
4. **Apply a Briefing Preset** or set custom topics (e.g., "AI, Tesla, Bitcoin")
5. **Schedule Time** (e.g., "08:00")

Done! News will generate automatically at your scheduled time.

## Documentation

For detailed setup instructions, API guides, and advanced features:

**[→ Read Full Documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/index.html)**

## Quick API Setup

### Gemini model access (checked October 17, 2026)
- **Free summaries:** RSS + Gemini, with the Model field blank, defaults to `gemini-3.8-flash`.
- **Google Search:** The agentic default stays `gemini-2.5-flash`. Its free grounding is restricted to eligible existing users and project quotas. It is not a universal free option for new API projects.
- **Newer models:** `gemini-3.8-flash` has free text generation, but Search grounding requires the paid API tier. `gemini-4-argon` requires paid access. AI Studio chat access and API tool access are different.
- Check [Google API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [model access](https://ai.google.dev/gemini-api/docs/models) for your project. The plugin does not automatically switch to a paid model on failure.
- [Create a Gemini API key](https://aistudio.google.com/apikey).

### Google Custom Search migration
This legacy API is closed to new customers and ends on **January 1, 2027**. Existing configurations are preserved. Switch to Perplexity Search, RSS, or an agentic provider in settings. See [Google's notice](https://developers.google.com/custom-search/v1/overview).

### Updated model defaults
OpenAI: `gpt-6.1-sol`; Claude: `claude-sonnet-5-5`; Grok: `grok-4.7`; OpenRouter: `anthropic/claude-sonnet-5.5`; Perplexity: `sonar`.
Known previous defaults migrate once; other custom IDs are preserved. Leave Gemini's Model field blank to use the mode-specific default. Agentic connection tests for OpenAI, Gemini and OpenRouter perform real searches and may incur API/search charges.

### Paid Options (1 API Key)
- **Perplexity**: [perplexity.ai](https://perplexity.ai/)
- **OpenAI GPT**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Grok (xAI)**: [x.ai](https://x.ai/)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **OpenRouter**: [openrouter.ai](https://openrouter.ai/keys)

## Usage

**Automatic**: Set schedule time, plugin generates daily at that time

**Manual**:
- Command Palette: `Ctrl/Cmd + P` → "Generate news now"
- Sidebar: Click 📰 icon (opens today's news or creates it)

**Retry after failure**: Run “Retry news generation (save a new note)” from the command palette. It preserves existing notes and reuses only successful, still-current topic caches.

**Quality and limits**: All modes apply the News time window (new installs: `d1`, last 24 hours; existing windows are preserved). Unknown dates are excluded by default. Source metadata dates, model-reported dates and unknown dates are labeled separately. Date-only sources cannot prove exact 24-hour freshness. Native search normally uses two model calls per topic: research with native citations, then a non-search JSON formatting call. Sonar can search again on the second call. RSS + Gemini uses one non-search model call per topic.

Output links are generated from native citation/retrieval metadata, never arbitrary model-authored URLs. Schema and source checks do not independently fact-check every claim. Custom prompts remain editorial preferences; JSON, source and time rules take precedence. The structured renderer controls item formatting; custom note templates still work.

Request limits cover output tokens, timeout, bounded retries, and search counts where the provider supports them. Optional usage shows reported successful generation metadata, excluding unreported, failed/retried and retriever calls. It is not a currency budget or billing estimate. Obsidian transport timeouts cannot cancel server-side work. See [quality and reliability details](docs/advanced.html#quality).

**Presets**: Start from Morning Brief, Market Watch, AI/Tech Tracker, Research Digest, Company Monitor, or RSS Digest. Presets update topics, output style, and briefing focus while preserving API keys, provider choice, schedule, language, and archive settings.

## Troubleshooting

**No news generated?**
- Use the **Test Connection** button in API Configuration settings to verify your key and model
- Verify API keys (no extra spaces)
- Check topics are configured
- Try manual generation to see errors

**API errors?**
- Use the **Test Connection** button to identify the exact error
- Check API key validity
- Verify account has credits/quota
- Check [full documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/usage.html#troubleshooting)

## Publishing

Push a version tag such as `1.13.4` to run the automated tests, build and GitHub Release workflow.
See [release instructions](docs/releasing.md) for preparation and failure recovery.

## Changelog

### v1.13.4
- Refresh model defaults with a one-time migration; retain custom model IDs.
- Separate Gemini defaults for legacy free Search and current free-tier summaries.
- Enable OpenRouter server search and check retrieval evidence for OpenAI, Gemini and OpenRouter.
- Migrate all Gemini calls to the maintained GenAI SDK.
- Add Google Custom Search retirement guidance.
- Fix local-calendar dates, configuration-aware caches, missed schedules and overlapping generation.
- Parse native sources for all six agentic providers and validate structured news before rendering.
- Apply time filtering across all pipelines, distinguish source/reported/unknown dates, and separate factual summaries from AI analysis.
- Return typed success/empty/error outcomes; count actual items and reject truncated output.
- Revalidate cached freshness and add retry-to-new-note without overwriting existing notes.
- Add request limits, bounded retries, optional reported usage, and CI checks.
- Accept `null` for omitted optional AI analysis, and treat missing registered secrets as missing credentials instead of sending secret labels to APIs.
- Add offline regression and packaged HTTP transport tests (`npm test`), plus an optional real RSS smoke test (`npm run test:live-rss`, no model calls or vault writes).
- Automate tested release builds, version validation, checksums and build provenance through GitHub Actions.

### v1.13.3 && v1.13.2 && v1.13.1
- Support customized model name
- Update models

### Previous Versions
<details>
<summary>Click to view changelog history</summary>

**1.13.0**
- Add preset configuration

**1.12.2**
- Enhance code security and performance
- Bump minimum Obsidian version to 1.11.4

**1.12.1**
- New Features
    - Add Perpelxity Search as an alternative from unavaiable Google Search
    - Support all avaiable OpenRouter model as a text input
    - Add Test Connection button in API Configuration
- Enhancement
    - Update default models: Claude Sonnet 4.6, Grok 4.3 and GPT 5.5

**1.11.10**
- Add daily news content caching as a button, enabled by default
- Improve generation failure check
- Fix old news notes manual deletion

**1.11.9**
- Add old news notes auto deletion function
- Remove empty news folders after deletion

**1.11.8**
- Fix metadata tags and source legacy generation issue

**1.11.7**
- Fix secret key migration logic, and refactor to an optional button
- Fix OpenRouter Claude model name
- Improve daily news content caching logic

**1.11.6**
- Fix Obsidian secret storage migration logic

**1.11.5**
- Fix daily news content cache. Now it only caches when news generation succeeds
- Remove duplicate notification and add more failure info
- Add schedule time

**1.11.4**
- Support Obsidian secret storage and add migration function. Requires update Obsidian to latest.

**1.11.3**
- Support Gemini agentic search and list as the top recommendation

**1.11.2**
- Refactor workflow pipeline and support migration logic
- Rewrite docs.html

**1.11.1**
- Merge metadata date and time, and add migration logic
- Support monthly notes subfolder organization, and one-click reorganize

**1.11.0**
- Support RSS retriever
- Improve template setting and exmaple content display

**1.10.2**
- Improve setting tab frontend
- Template
    - Add copy button for the template note example
    - Fix template cannot find issue in subfolders
- Cache
    - Fix "clear cache" button display issue
    - Automatically clear previous daily news content everyday
    - Fix cache content number display error

**1.10.1**
- Reduce token cost
    - Fix AI-generated query cache
    - Add daily news cache
- Fix duplicate toc title

**1.10.0**
- Support Anthropic and OpenRouter models

**1.9.1**
- Fix metadata settings

**1.9.0**
- Support customizable template setting

**1.8.2**
- Fix Grok agentic search

**1.8.1**
- Add Grok support

**1.8.0**
- Refactor provider architecture
    - Separated providers into `agentic-search` and `search-then-summarize` categories.
    - This improves code organization and makes it easier to add new providers in the future.
    - Add migration support.

**1.7.7**
- Fix Google issues
    - Extend api timeout limit
    - Improve news number limit for custom search

**1.7.6**
- Fix OpenAI issues
    - Update model to gpt-5-search-api
    - Fix openai base url error

**1.7.5**
- Fix issues
    - Replace gemini-2.0-flash with gemini-2.5-flash
    - Enable GPT option
    - Update settings

**1.7.4**
- Reduce token consumption for Gemini API due to Google new policy for free tier
   - Add prompt cache for query generation
   - Optimize prompt

**1.7.3**
- Add OpenAI models support

**1.7.2**
- Multi-language support (EN, FR, DE, ES, IT)
- Improved error handling
- Better metadata generation

**v1.6.2**
- Toggle Analysis & Context section on/off

**v1.6.1** 
- Better failure handling for note generation

**v1.6.0**
- AI-powered news filtering (replaces rule-based)

**v1.5.1**
- Upgraded to Gemini Flash 2.0

**v1.5.0**
- AI-generated search queries for better results
- Enhanced Google API performance
- Upgraded to Gemini Flash 2.5

**v1.4.2**
- Enhanced Sonar API prompts

**v1.4.1**
- Improved Sonar API performance
- Simplified Sonar settings

**v1.4.0**
- Added Perplexity Sonar support
- API request throttling
- Enhanced documentation

**v1.3.1**
- Clearer settings names

**v1.3.0**
- Added sidebar button for easy access
- Auto-create or open today's news

**v1.2.1**
- Prevent duplicate daily summaries
- Updated documentation

**v1.2.0**
- Performance optimizations
- Better console logging

**v1.1.1**
- Improved news filtering

**v1.1.0**
- Simplified configuration
- Better summarization and layout

**v1.0.0**
- Initial release
- Core news fetching and summarization
</details>

## Contribute & Roadmap

Contributions welcome! We especially appreciate:
- Bug reports and fixes
- New language translations
- Documentation improvements
- Feature suggestions

### Roadmap

- [x] **More Providers** - Support for more LLM options (Issue #6)
- [x] **Cache Daily News Content** - Avoid redundant generation
- [x] **Cache AI-generated Queries** - Reduce token cost
- [ ] **More Web Search Choices** - Replacement of Google Search
- [ ] **Custom Domains** - Support new Google Search

### Contributors

<a href="https://github.com/ChenziqiAdam/Daily-News-Briefing/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ChenziqiAdam/Daily-News-Briefing" />
</a>

## Support

If this plugin helps you stay informed:

[![Buy Me a Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/adamchen)

## License

MIT License - Use freely and modify as needed

---

**[Full Documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/index.html)** | [Report Issues](https://github.com/ChenziqiAdam/Daily-News-Briefing/issues) | [GitHub](https://github.com/ChenziqiAdam/Daily-News-Briefing)
