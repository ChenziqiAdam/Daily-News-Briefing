import type { TemplateData } from '../types';
import { TEMPLATE_PRESETS } from './template-presets';
import type { App } from 'obsidian';
import { TFile } from 'obsidian';

export class TemplateEngine {
    /**
     * Render a template with provided data
     */
    static renderTemplate(
        templateType: 'default' | 'minimal' | 'detailed' | 'custom' | 'file',
        customTemplate: string,
        data: TemplateData,
        templateFileContent?: string
    ): string {
        // Get the template based on type
        let template: string;

        if (templateType === 'file' && templateFileContent) {
            template = templateFileContent;
        } else if (templateType === 'custom') {
            template = customTemplate || TEMPLATE_PRESETS.default;
        } else if (templateType === 'file') {
            // Fallback if file type but no content
            template = TEMPLATE_PRESETS.default;
        } else {
            template = TEMPLATE_PRESETS[templateType];
        }

        // Replace all placeholders with actual data
        let result = template;

        // Basic placeholders
        result = result.replace(/\{\{METADATA\}\}/g, data.metadata);
        result = result.replace(/\{\{TIMESTAMP\}\}/g, data.timestamp);
        result = result.replace(/\{\{DATE\}\}/g, data.date);
        result = result.replace(/\{\{TIME\}\}/g, data.time);
        result = result.replace(/\{\{TABLE_OF_CONTENTS\}\}/g, data.tableOfContents);
        result = result.replace(/\{\{TOPICS\}\}/g, data.topics);
        result = result.replace(/\{\{PROCESSING_STATUS\}\}/g, data.processingStatus);
        result = result.replace(/\{\{LANGUAGE\}\}/g, data.language);

        // Fine-grained date/time placeholders
        result = result.replace(/\{\{YEAR\}\}/g, data.year);
        result = result.replace(/\{\{MONTH\}\}/g, data.month);
        result = result.replace(/\{\{MONTH_NAME\}\}/g, data.monthName);
        result = result.replace(/\{\{MONTH_NAME_SHORT\}\}/g, data.monthNameShort);
        result = result.replace(/\{\{DAY\}\}/g, data.day);
        result = result.replace(/\{\{DAY_NAME\}\}/g, data.dayName);
        result = result.replace(/\{\{DAY_NAME_SHORT\}\}/g, data.dayNameShort);
        result = result.replace(/\{\{HOUR\}\}/g, data.hour);
        result = result.replace(/\{\{MINUTE\}\}/g, data.minute);
        result = result.replace(/\{\{SECOND\}\}/g, data.second);

        // Metadata field placeholders
        result = result.replace(/\{\{METADATA_DATE\}\}/g, data.metadataDate);
        result = result.replace(/\{\{METADATA_TIME\}\}/g, data.metadataTime);
        result = result.replace(/\{\{METADATA_TAGS\}\}/g, data.metadataTags);
        result = result.replace(/\{\{METADATA_LANGUAGE\}\}/g, data.metadataLanguage);
        result = result.replace(/\{\{METADATA_PROVIDER\}\}/g, data.metadataProvider);

        // Topic info placeholders
        result = result.replace(/\{\{TOPIC_COUNT\}\}/g, data.topicCount);
        result = result.replace(/\{\{TOPIC_LIST\}\}/g, data.topicList);

        // Clean up any empty sections
        result = this.cleanupEmptyLines(result);

        return result;
    }

    /**
     * Load template from a file in the vault
     */
    static async loadTemplateFile(app: App, filePath: string): Promise<string | null> {
        try {
            if (!filePath || filePath.trim() === '') {
                return null;
            }

            // Normalize path - trim and remove leading slash
            let normalizedPath = filePath.trim();

            // Remove leading slash if present
            if (normalizedPath.startsWith('/')) {
                normalizedPath = normalizedPath.substring(1);
            }

            // Add .md extension if not present
            if (!normalizedPath.endsWith('.md')) {
                normalizedPath += '.md';
            }

            // Check if file exists
            const file = app.vault.getAbstractFileByPath(normalizedPath);

            if (!file || !(file instanceof TFile)) {
                console.error(`Template file not found: ${normalizedPath}`);
                return null;
            }

            // Read file content
            const content = await app.vault.read(file);
            return content;
        } catch (error) {
            console.error('Error loading template file:', error);
            return null;
        }
    }

    /**
     * Validate a template to ensure it has required placeholders
     */
    static validateTemplate(template: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check if template is not empty
        if (!template || template.trim().length === 0) {
            errors.push('Template cannot be empty');
            return { valid: false, errors };
        }

        // Warn if {{TOPICS}} is missing (most critical placeholder)
        if (!template.includes('{{TOPICS}}')) {
            errors.push('Template should include {{TOPICS}} placeholder to display news content');
        }

        // Check for unknown placeholders
        const validPlaceholders = this.getValidPlaceholders();
        const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
        const matches = template.match(placeholderRegex);

        if (matches) {
            for (const match of matches) {
                if (!validPlaceholders.includes(match)) {
                    errors.push(`Unknown placeholder: ${match}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get all valid placeholder names
     */
    static getValidPlaceholders(): string[] {
        return [
            // Basic
            '{{METADATA}}', '{{TIMESTAMP}}', '{{DATE}}', '{{TIME}}',
            '{{TABLE_OF_CONTENTS}}', '{{TOPICS}}', '{{PROCESSING_STATUS}}', '{{LANGUAGE}}',
            // Date/Time
            '{{YEAR}}', '{{MONTH}}', '{{MONTH_NAME}}', '{{MONTH_NAME_SHORT}}',
            '{{DAY}}', '{{DAY_NAME}}', '{{DAY_NAME_SHORT}}',
            '{{HOUR}}', '{{MINUTE}}', '{{SECOND}}',
            // Metadata
            '{{METADATA_DATE}}', '{{METADATA_TIME}}', '{{METADATA_TAGS}}',
            '{{METADATA_LANGUAGE}}', '{{METADATA_PROVIDER}}',
            // Topic info
            '{{TOPIC_COUNT}}', '{{TOPIC_LIST}}'
        ];
    }

    /**
     * Extract placeholders from a template
     */
    static parsePlaceholders(template: string): string[] {
        const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
        const matches = template.match(placeholderRegex);
        if (!matches) return [];

        // Deduplicate matches
        const uniqueMatches: string[] = [];
        for (const match of matches) {
            if (!uniqueMatches.includes(match)) {
                uniqueMatches.push(match);
            }
        }
        return uniqueMatches;
    }

    /**
     * Get the default template
     */
    static getDefaultTemplate(): string {
        return TEMPLATE_PRESETS.default;
    }

    /**
     * Clean up empty lines and excessive whitespace
     */
    private static cleanupEmptyLines(content: string): string {
        // Remove lines that only contain whitespace
        let cleaned = content.replace(/^\s*[\r\n]/gm, '\n');

        // Remove more than 2 consecutive newlines
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        // Trim leading and trailing whitespace
        cleaned = cleaned.trim();

        return cleaned;
    }

    /**
     * Get available placeholders info (organized by category)
     */
    static getPlaceholderInfo(): { category: string; placeholders: { placeholder: string; description: string }[] }[] {
        return [
            {
                category: 'Basic',
                placeholders: [
                    { placeholder: '{{METADATA}}', description: 'YAML frontmatter (if enabled)' },
                    { placeholder: '{{TIMESTAMP}}', description: 'Generation time (e.g., "Generated at 10:30:00 AM")' },
                    { placeholder: '{{DATE}}', description: 'Current date (YYYY-MM-DD)' },
                    { placeholder: '{{TIME}}', description: 'Current time (HH:MM:SS)' },
                    { placeholder: '{{TABLE_OF_CONTENTS}}', description: 'Auto-generated TOC' },
                    { placeholder: '{{TOPICS}}', description: 'All topic sections' },
                    { placeholder: '{{PROCESSING_STATUS}}', description: 'Error summary (if errors)' },
                    { placeholder: '{{LANGUAGE}}', description: 'Language code (e.g., "en")' }
                ]
            },
            {
                category: 'Date/Time (Fine-grained)',
                placeholders: [
                    { placeholder: '{{YEAR}}', description: 'Year (YYYY)' },
                    { placeholder: '{{MONTH}}', description: 'Month number (MM)' },
                    { placeholder: '{{MONTH_NAME}}', description: 'Full month name (January, February...)' },
                    { placeholder: '{{MONTH_NAME_SHORT}}', description: 'Short month (Jan, Feb...)' },
                    { placeholder: '{{DAY}}', description: 'Day of month (DD)' },
                    { placeholder: '{{DAY_NAME}}', description: 'Full day name (Monday, Tuesday...)' },
                    { placeholder: '{{DAY_NAME_SHORT}}', description: 'Short day (Mon, Tue...)' },
                    { placeholder: '{{HOUR}}', description: 'Hour (HH, 24-hour format)' },
                    { placeholder: '{{MINUTE}}', description: 'Minute (MM)' },
                    { placeholder: '{{SECOND}}', description: 'Second (SS)' }
                ]
            },
            {
                category: 'Metadata Fields',
                placeholders: [
                    { placeholder: '{{METADATA_DATE}}', description: 'Date from metadata' },
                    { placeholder: '{{METADATA_TIME}}', description: 'Time from metadata' },
                    { placeholder: '{{METADATA_TAGS}}', description: 'Comma-separated tags' },
                    { placeholder: '{{METADATA_LANGUAGE}}', description: 'Language from metadata' },
                    { placeholder: '{{METADATA_PROVIDER}}', description: 'API provider name' }
                ]
            },
            {
                category: 'Topic Information',
                placeholders: [
                    { placeholder: '{{TOPIC_COUNT}}', description: 'Number of topics' },
                    { placeholder: '{{TOPIC_LIST}}', description: 'Comma-separated topic names' }
                ]
            }
        ];
    }
}
