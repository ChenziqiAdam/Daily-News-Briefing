import { App, TFile, Notice } from 'obsidian';
import type { DailyNewsSettings, TopicStatus, NewsMetadata} from './types';
import { LANGUAGE_TRANSLATIONS } from './constants';

export class FileUtils {
    static normalizePath(path: string): string {
        // Ensure path doesn't start with a slash
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        
        // Replace any double slashes with single slashes
        path = path.replace(/\/+/g, '/');
        
        return path;
    }

    static async openNewsFile(app: App, filePath: string) {
        try {
            // Normalize the path for consistent handling
            filePath = FileUtils.normalizePath(filePath);
            
            // Try to get the file from the vault
            const file = app.vault.getAbstractFileByPath(filePath);
            
            if (file instanceof TFile) {
                // Try to open the file using workspace API
                app.workspace.openLinkText(file.path, '', false)
                    .then(() => {
                        new Notice('Opened today\'s news briefing');
                    })
                    .catch(error => {
                        // Fallback: Try to actively focus the leaf after opening
                        app.workspace.getLeaf(false).openFile(file)
                            .then(() => {
                                new Notice('Opened today\'s news briefing (fallback method)');
                            })
                            .catch(e => {
                                new Notice('Unable to open news file. Try opening it manually.');
                            });
                    });
            } else {
                new Notice(`Unable to find news file. Please check path: ${filePath}`);
            }
        } catch (error) {
            new Notice('Error opening news file');
        }
    }
}

export class ValidationUtils {
    // This class can be extended with other validation methods in the future
    // API validation is now handled by the NewsProviderFactory
}

export class LanguageUtils {
    static getTranslation(key: string, language: string): string {
        // Get the language-specific translations or default to English
        const translations = LANGUAGE_TRANSLATIONS[language] || LANGUAGE_TRANSLATIONS['en'];
        
        // Return the translation for the key or the key itself if no translation exists
        return translations[key] || LANGUAGE_TRANSLATIONS['en'][key] || key;
    }
}

export class MetadataUtils {
    static generateMetadata(
        settings: DailyNewsSettings, 
        processingStartTime: number,
    ): NewsMetadata {
        const metadata: NewsMetadata = {};
        const processingEndTime = Date.now();
        const processingTimeMs = processingEndTime - processingStartTime;

        if (settings.includeDate) {
            metadata.date = new Date().toISOString().split('T')[0];
        }

        if (settings.includeTime) {
            metadata.time = new Date().toLocaleTimeString();
        }

        if (settings.includeTopics) {
            metadata.topics = [...settings.topics];
        }

        if (settings.includeLanguage) {
            metadata.language = settings.language;
        }

        if (settings.includeProcessingTime) {
            const seconds = Math.round(processingTimeMs / 1000);
            metadata.processingTime = `${seconds}s`;
        }

        if (settings.includeTags) {
            // Generate tags from topics and add some standard tags
            const topicTags = settings.topics.map(topic =>
                topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            );
            const standardTags = ['daily-news', settings.apiProvider];
            metadata.tags = [...new Set([...topicTags, ...standardTags])];
        }

        if (settings.includeSource) {
            switch (settings.apiProvider) {
                case 'google-gemini':
                    metadata.source = 'Google Search + Gemini AI';
                    break;
                case 'google-gpt':
                    metadata.source = 'Google Search + OpenAI GPT';
                    break;
                case 'google-grok':
                    metadata.source = 'Google Search + Grok';
                    break;
                case 'google-claude':
                    metadata.source = 'Google Search + Anthropic Claude';
                    break;
                case 'google-openrouter':
                    metadata.source = 'Google Search + OpenRouter';
                    break;
                case 'sonar':
                    metadata.source = 'Perplexity Sonar';
                    break;
                case 'gpt':
                    metadata.source = 'OpenAI GPT';
                    break;
                case 'grok':
                    metadata.source = 'Grok';
                    break;
                case 'claude':
                    metadata.source = 'Anthropic Claude';
                    break;
                case 'openrouter':
                    metadata.source = 'OpenRouter';
            }
        }

        if (settings.includeOutputFormat) {
            metadata.outputFormat = settings.outputFormat;
        }

        return metadata;
    }

    static formatMetadataAsYAML(metadata: NewsMetadata): string {
        if (Object.keys(metadata).length === 0) {
            return '';
        }

        let yaml = '---\n';
        
        // Handle each metadata field with proper YAML formatting
        Object.entries(metadata).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    // Format arrays
                    if (value.length === 0) {
                        yaml += `${key}: []\n`;
                    } else if (value.length === 1) {
                        yaml += `${key}: ["${value[0]}"]\n`;
                    } else {
                        yaml += `${key}:\n`;
                        value.forEach(item => {
                            yaml += `  - "${item}"\n`;
                        });
                    }
                } else if (typeof value === 'string') {
                    // Escape quotes in string values
                    const escapedValue = value.replace(/"/g, '\\"');
                    yaml += `${key}: "${escapedValue}"\n`;
                } else {
                    // Numbers, booleans, etc.
                    yaml += `${key}: ${value}\n`;
                }
            }
        });
        
        yaml += '---\n\n';
        return yaml;
    }
}

export class ContentUtils {
    static buildTableOfContents(topics: string[]): string {
        let content = '';
        topics.forEach(topic => {
            content += `- [${topic}](#${topic.toLowerCase().replace(/\s+/g, '%20')})\n`;
        });
        return content;
    }

    static buildProcessingStatus(topicStatuses: TopicStatus[], language: string): string {
        let content = '\n---\n\n';
        content += `## ${LanguageUtils.getTranslation('processingStatus', language)}\n\n`;
        content += 'Some topics encountered issues during processing:\n\n';
        
        for (const status of topicStatuses) {
            if (status.error) {
                const stage = !status.retrievalSuccess ? 'News Retrieval' : 'News Summarization';
                content += `- **${status.topic}**: Issue during ${stage} - ${status.error}\n`;
            }
        }
        return content;
    }

    static analyzeTopicResults(topicStatuses: TopicStatus[]): {
        atLeastOneSuccessfulTopic: boolean;
        atLeastOneNewsItem: boolean;
        allTopicsFailed: boolean;
        errorSummary: string;
    } {
        const atLeastOneSuccessfulTopic = topicStatuses.some(status => 
            status.retrievalSuccess && status.summarizationSuccess);
            
        const atLeastOneNewsItem = topicStatuses.some(status => status.newsCount > 0);
        
        const allTopicsFailed = topicStatuses.every(status => 
            !status.retrievalSuccess || !status.summarizationSuccess);
            
        // Generate error analysis for logging
        const errorSummary = topicStatuses
            .filter(status => status.error)
            .map(status => `${status.topic}: ${status.error}`)
            .join('\n');
        
        return {
            atLeastOneSuccessfulTopic,
            atLeastOneNewsItem,
            allTopicsFailed,
            errorSummary
        };
    }
}