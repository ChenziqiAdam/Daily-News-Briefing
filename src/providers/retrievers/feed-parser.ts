import { XMLParser } from 'fast-xml-parser';

export interface FeedItem {
    title: string;
    link: string;
    published: string;
    content: string;
    categories: string[];
}
export interface Feed { title: string; items: FeedItem[] }

type Node = Record<string, unknown>;
const LIST_TAGS = new Set(['item', 'entry', 'category', 'link']);
// Pure JavaScript: must not depend on Node built-ins, which do not exist on mobile.
const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text',
    parseTagValue: false, parseAttributeValue: false, trimValues: true, htmlEntities: true,
    isArray: name => LIST_TAGS.has(name),
});
const node = (value: unknown): Node => value && typeof value === 'object' && !Array.isArray(value) ? value as Node : {};
const list = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string => typeof value === 'string' ? value.trim()
    : typeof value === 'number' ? String(value)
    : Array.isArray(value) ? text(value[0]) : text(node(value)['#text'] ?? '');

/** Parses RSS 2.0, RSS 1.0 (RDF) and Atom documents into one shape. */
export function parseFeed(xml: string): Feed {
    const doc = node(parser.parse(xml));
    const rdf = node(doc['rdf:RDF']);
    const channel = node(node(doc.rss).channel ?? rdf.channel);
    if (doc.rss || doc['rdf:RDF']) {
        return { title: text(channel.title), items: [...list(channel.item), ...list(rdf.item)].map(value => {
            const item = node(value);
            const guid = text(item.guid);
            return {
                title: text(item.title),
                link: text(item.link) || (/^https?:\/\//i.test(guid) ? guid : ''),
                published: text(item.pubDate) || text(item['dc:date']),
                content: text(item.description) || text(item['content:encoded']),
                categories: list(item.category).map(text).filter(Boolean),
            };
        }) };
    }
    if (doc.feed) {
        const feed = node(doc.feed);
        return { title: text(feed.title), items: list(feed.entry).map(value => {
            const entry = node(value);
            const links = list(entry.link).map(node);
            const link = links.find(l => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
            return {
                title: text(entry.title),
                link: text(link?.['@_href'] ?? ''),
                published: text(entry.published) || text(entry.updated),
                content: text(entry.summary) || text(entry.content),
                categories: list(entry.category).map(c => text(node(c)['@_term'] ?? c)).filter(Boolean),
            };
        }) };
    }
    throw new Error('Not an RSS or Atom feed.');
}
