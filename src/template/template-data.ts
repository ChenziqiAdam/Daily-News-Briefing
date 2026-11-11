import type { DailyNewsSettings, TemplateData, TopicContent, TopicStatus } from '../types';
import { ContentUtils, MetadataUtils } from '../utils';
import { strings } from '../i18n';

function buildTopicsSections(topicContents: TopicContent[]): string {
    let sections = '';
    for (const topicContent of topicContents) {
        sections += `\n---\n\n`;
        sections += `## ${topicContent.topic}\n\n`;
        sections += topicContent.content;
    }
    return sections;
}

/** Collects every value a note template can reference. */
export function buildTemplateData(settings: DailyNewsSettings, date: string, topicContents: TopicContent[], topicStatuses: TopicStatus[], processingStartTime: number): TemplateData {
    const now = new Date();
    const topicSections = buildTopicsSections(topicContents);
    const metadata = settings.enableMetadata
        ? MetadataUtils.generateMetadata(settings, processingStartTime)
        : {};

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Prepare template data with all placeholders
    return {
        // Basic placeholders
        metadata: settings.enableMetadata
            ? MetadataUtils.formatMetadataAsYAML(metadata)
            : '',
        timestamp: `${strings(settings.language).generatedAt} ${now.toLocaleTimeString()}`,
        date: date,
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        tableOfContents: ContentUtils.buildTableOfContents(settings.topics),
        topics: topicSections,
        topicContents: topicContents,
        processingStatus: topicStatuses.some(status => status.error)
            ? ContentUtils.buildProcessingStatus(topicStatuses, settings.language)
            : '',
        language: settings.language,

        // Fine-grained date/time placeholders
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString().padStart(2, '0'),
        monthName: monthNames[now.getMonth()],
        monthNameShort: monthNamesShort[now.getMonth()],
        day: now.getDate().toString().padStart(2, '0'),
        dayName: dayNames[now.getDay()],
        dayNameShort: dayNamesShort[now.getDay()],
        hour: now.getHours().toString().padStart(2, '0'),
        minute: now.getMinutes().toString().padStart(2, '0'),
        second: now.getSeconds().toString().padStart(2, '0'),

        // Metadata field placeholders
        metadataDatetime: metadata.datetime || '',
        metadataTags: metadata.tags ? metadata.tags.join(', ') : '',
        metadataLanguage: metadata.language || '',
        metadataProvider: metadata.source || '',

        // Topic info placeholders
        topicCount: settings.topics.length.toString(),
        topicList: settings.topics.join(', '),

        // Topic sections (for future loop support)
        topicSections: topicSections
    };
}
