/**
 * Template presets for daily news generation
 *
 * Available placeholders:
 *
 * BASIC:
 * - {{METADATA}} - YAML frontmatter (if enabled)
 * - {{TIMESTAMP}} - Generation time (e.g., "Generated at 10:30:00 AM")
 * - {{DATE}} - Current date (YYYY-MM-DD)
 * - {{TIME}} - Current time (HH:MM:SS)
 * - {{TABLE_OF_CONTENTS}} - Auto-generated table of contents
 * - {{TOPICS}} - All topic sections combined
 * - {{PROCESSING_STATUS}} - Error summary (if any errors occurred)
 * - {{LANGUAGE}} - Language code
 *
 * DATE/TIME (Fine-grained):
 * - {{YEAR}} - Year (YYYY)
 * - {{MONTH}} - Month (MM)
 * - {{MONTH_NAME}} - Month name (January, February, etc.)
 * - {{MONTH_NAME_SHORT}} - Short month (Jan, Feb, etc.)
 * - {{DAY}} - Day (DD)
 * - {{DAY_NAME}} - Day name (Monday, Tuesday, etc.)
 * - {{DAY_NAME_SHORT}} - Short day (Mon, Tue, etc.)
 * - {{HOUR}} - Hour (HH, 24-hour)
 * - {{MINUTE}} - Minute (MM)
 * - {{SECOND}} - Second (SS)
 *
 * METADATA (Individual fields):
 * - {{METADATA_DATETIME}} - Date and time from metadata
 * - {{METADATA_TAGS}} - Comma-separated tags
 * - {{METADATA_LANGUAGE}} - Language from metadata
 * - {{METADATA_PROVIDER}} - API provider name
 *
 * TOPIC INFO:
 * - {{TOPIC_COUNT}} - Number of topics
 * - {{TOPIC_LIST}} - Comma-separated topic names
 */

export const TEMPLATE_PRESETS = {
    default: `{{METADATA}}*{{TIMESTAMP}}*

---

## Table of Contents

{{TABLE_OF_CONTENTS}}

{{TOPICS}}
{{PROCESSING_STATUS}}`,

    minimal: `{{METADATA}}# Daily News - {{DATE}}

{{TOPICS}}`,

    detailed: `{{METADATA}}# Daily News Briefing
**Date:** {{DATE}}
**Generated:** {{TIMESTAMP}}

---

## Table of Contents

{{TABLE_OF_CONTENTS}}

---

{{TOPICS}}

---

{{PROCESSING_STATUS}}`,

    custom: '' // User-defined template
};

export const TEMPLATE_DESCRIPTIONS = {
    default: 'Original format with timestamp, TOC, and topics',
    minimal: 'Compact format - just topics without TOC',
    detailed: 'Detailed format with extra metadata and separators',
    custom: 'Your own custom template (text editor)',
    file: 'Use a template file from your vault'
};

export const TEMPLATE_EXAMPLE = `Example custom template:

# Daily News - {{MONTH_NAME}} {{DAY}}, {{YEAR}}
*Generated: {{TIMESTAMP}}*

**Topics covered:** {{TOPIC_LIST}}
**Language:** {{LANGUAGE}}

{{TABLE_OF_CONTENTS}}

{{TOPICS}}

---
{{PROCESSING_STATUS}}

Available placeholders:
Basic: {{METADATA}}, {{TIMESTAMP}}, {{DATE}}, {{TIME}}, {{TOPICS}}, {{TABLE_OF_CONTENTS}}
Date/Time: {{YEAR}}, {{MONTH}}, {{DAY}}, {{MONTH_NAME}}, {{DAY_NAME}}, etc.
Metadata: {{METADATA_TAGS}}, {{METADATA_PROVIDER}}, etc.
Topics: {{TOPIC_COUNT}}, {{TOPIC_LIST}}`;

export const TEMPLATE_FILE_EXAMPLE = `Create a note in your vault (e.g., "Templates/Daily News Template.md") with:

# 📰 News for {{MONTH_NAME_SHORT}} {{DAY}}, {{YEAR}}

> [!info] Generation Info
> - **Time:** {{TIME}}
> - **Topics:** {{TOPIC_COUNT}}
> - **Provider:** {{METADATA_PROVIDER}}

## Contents
{{TABLE_OF_CONTENTS}}

---

{{TOPICS}}

---

## Metadata
- Generated: {{TIMESTAMP}}
- Language: {{LANGUAGE}}
- Tags: {{METADATA_TAGS}}

{{PROCESSING_STATUS}}`;
