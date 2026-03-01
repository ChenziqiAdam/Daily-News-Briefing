# Daily News Briefing for Obsidian

> [Official Website](https://chenziqiadam.github.io/Daily-News-Briefing/) | [Full Documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/index.html)

**AI-powered daily news summaries delivered automatically to your Obsidian vault.**

## ✨ Features

- 🤖 **11 AI Pipelines + RSS**: Google, Anthropic, OpenAI, Grok, Perplexity, OpenRouter, RSS Retriever
- 📅 **Auto-Scheduled**: Wake up to fresh news every day
- 🎯 **Custom Topics**: Track exactly what matters to you
- 🌍 **6 Languages**: English, French, German, Spanish, Italian, Chinese
- 🎨 **Flexible Templates**: 5 presets + custom templates with 25 placeholders
- 📱 **One-Click Access**: Sidebar button for instant generation
- 📁 **Auto-Organization**: Monthly subfolders keep your archive clean and organized

## 🚀 Quick Start

1. **Install** from Obsidian Community Plugins
2. **Choose AI Provider** (we recommend Gemini Agentic - it's free!)
3. **Add API Key(s)** in settings
4. **Set Topics** (e.g., "AI, Tesla, Bitcoin")
5. **Schedule Time** (e.g., "08:00")

Done! News will generate automatically at your scheduled time.

## 📖 Documentation

For detailed setup instructions, API guides, and advanced features:

**[→ Read Full Documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/index.html)**

## 🔑 Quick API Setup

### Free Option (Recommended)
**Gemini** - 1 free API key:
- [Gemini API Key](https://aistudio.google.com/apikey)

### Paid Options (1 API Key)
- **Perplexity**: [perplexity.ai](https://perplexity.ai/)
- **OpenAI GPT**: [platform.openai.com](https://platform.openai.com/api-keys)
- **Grok (xAI)**: [x.ai](https://x.ai/)
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
- **OpenRouter**: [openrouter.ai](https://openrouter.ai/keys)

## 📱 Usage

**Automatic**: Set schedule time, plugin generates daily at that time

**Manual**:
- Command Palette: `Ctrl/Cmd + P` → "Generate news now"
- Sidebar: Click 📰 icon (opens today's news or creates it)

## 🚨 Troubleshooting

**No news generated?**
- Verify API keys (no extra spaces)
- Check topics are configured
- Try manual generation to see errors

**API errors?**
- Check API key validity
- Verify account has credits/quota
- Check [full documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/usage.html#troubleshooting)

## 📋 Changelog

### v1.11.3
- Support Gemini agentic search and list as the top recommendation

### Previous Versions
<details>
<summary>Click to view changelog history</summary>

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

## 🤝 Contribute & Roadmap

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

## ❤️ Support

If this plugin helps you stay informed:

[![Buy Me a Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/adamchen)

## 📄 License

MIT License - Use freely and modify as needed

---

**[Full Documentation](https://chenziqiadam.github.io/Daily-News-Briefing/docs/index.html)** | [Report Issues](https://github.com/ChenziqiAdam/Daily-News-Briefing/issues) | [GitHub](https://github.com/ChenziqiAdam/Daily-News-Briefing)
