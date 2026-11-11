/** Every user-facing note string, per language. This is the only translation table. */
export type WarningCode = 'unverified_source' | 'outside_window' | 'unknown_date_excluded' | 'reported_date' | 'unknown_date' | 'date_precision' | 'partial_feeds';

export interface Strings {
    /** Label in the settings dropdown. */
    name: string;
    facts: string;
    analysis: string;
    sourceDate: string;
    reported: string;
    unknown: string;
    empty: string;
    warning: string;
    usage: string;
    generatedAt: string;
    processingStatus: string;
    issuesIntro: string;
    errorRetrieving: string;
    warnings: Record<WarningCode, string>;
}

export const STRINGS: Record<string, Strings> = {
    en: {
        name: 'English',
        facts: 'Key Developments', analysis: 'AI analysis', sourceDate: 'Published',
        reported: 'Reported date (not independently verified)', unknown: 'Publication date unknown',
        empty: 'No source-backed news found in the selected time window.', warning: 'Quality notes', usage: 'API usage',
        generatedAt: 'Generated at', processingStatus: 'Processing Status',
        issuesIntro: 'Some topics encountered issues during processing:', errorRetrieving: 'Error retrieving news for',
        warnings: {
            unverified_source: 'Items with unknown source references were excluded.',
            outside_window: 'Older or future-dated items were excluded.',
            unknown_date_excluded: 'Items without a usable publication date were excluded.',
            reported_date: 'Some dates were reported by the model and could not be verified from source metadata.',
            unknown_date: 'Undated items were included at your request; freshness cannot be confirmed.',
            date_precision: 'Some sources provide dates without times; exact 24-hour freshness cannot be confirmed.',
            partial_feeds: 'Some RSS feeds failed; coverage is incomplete.',
        },
    },
    fr: {
        name: 'Français (French)',
        facts: 'Actualités clés', analysis: 'Analyse IA', sourceDate: 'Publié',
        reported: 'Date rapportée (non vérifiée indépendamment)', unknown: 'Date de publication inconnue',
        empty: 'Aucune actualité sourcée dans la période sélectionnée.', warning: 'Notes de qualité', usage: 'Utilisation API',
        generatedAt: 'Généré à', processingStatus: 'Statut du Traitement',
        issuesIntro: 'Certains sujets ont rencontré des problèmes lors du traitement :', errorRetrieving: 'Erreur lors de la récupération des actualités pour',
        warnings: {
            unverified_source: 'Les éléments citant des sources inconnues ont été exclus.',
            outside_window: 'Les éléments trop anciens ou datés dans le futur ont été exclus.',
            unknown_date_excluded: 'Les éléments sans date de publication exploitable ont été exclus.',
            reported_date: 'Certaines dates ont été indiquées par le modèle et n’ont pas pu être vérifiées à partir des métadonnées des sources.',
            unknown_date: 'Des éléments non datés ont été inclus à votre demande ; leur actualité ne peut pas être confirmée.',
            date_precision: 'Certaines sources indiquent une date sans heure ; la fraîcheur exacte sur 24 heures ne peut pas être confirmée.',
            partial_feeds: 'Certains flux RSS ont échoué ; la couverture est incomplète.',
        },
    },
    de: {
        name: 'Deutsch (German)',
        facts: 'Wichtige Entwicklungen', analysis: 'KI-Analyse', sourceDate: 'Veröffentlicht',
        reported: 'Gemeldetes Datum (nicht unabhängig geprüft)', unknown: 'Veröffentlichungsdatum unbekannt',
        empty: 'Keine belegten Nachrichten im gewählten Zeitraum.', warning: 'Qualitätshinweise', usage: 'API-Nutzung',
        generatedAt: 'Erstellt am', processingStatus: 'Verarbeitungsstatus',
        issuesIntro: 'Bei einigen Themen sind während der Verarbeitung Probleme aufgetreten:', errorRetrieving: 'Fehler beim Abrufen von Nachrichten für',
        warnings: {
            unverified_source: 'Einträge mit unbekannten Quellenangaben wurden ausgeschlossen.',
            outside_window: 'Ältere oder in der Zukunft datierte Einträge wurden ausgeschlossen.',
            unknown_date_excluded: 'Einträge ohne verwertbares Veröffentlichungsdatum wurden ausgeschlossen.',
            reported_date: 'Einige Daten stammen vom Modell und konnten nicht anhand der Quellenmetadaten überprüft werden.',
            unknown_date: 'Undatierte Einträge wurden auf Ihren Wunsch aufgenommen; ihre Aktualität kann nicht bestätigt werden.',
            date_precision: 'Einige Quellen geben nur ein Datum ohne Uhrzeit an; die genaue 24-Stunden-Aktualität kann nicht bestätigt werden.',
            partial_feeds: 'Einige RSS-Feeds sind fehlgeschlagen; die Abdeckung ist unvollständig.',
        },
    },
    es: {
        name: 'Español (Spanish)',
        facts: 'Novedades clave', analysis: 'Análisis de IA', sourceDate: 'Publicado',
        reported: 'Fecha indicada (sin verificación independiente)', unknown: 'Fecha de publicación desconocida',
        empty: 'No hay noticias con fuentes en el período seleccionado.', warning: 'Notas de calidad', usage: 'Uso de API',
        generatedAt: 'Generado a las', processingStatus: 'Estado del Procesamiento',
        issuesIntro: 'Algunos temas tuvieron problemas durante el procesamiento:', errorRetrieving: 'Error al recuperar noticias para',
        warnings: {
            unverified_source: 'Se excluyeron los elementos con referencias a fuentes desconocidas.',
            outside_window: 'Se excluyeron los elementos antiguos o con fecha futura.',
            unknown_date_excluded: 'Se excluyeron los elementos sin una fecha de publicación utilizable.',
            reported_date: 'Algunas fechas fueron indicadas por el modelo y no pudieron verificarse con los metadatos de las fuentes.',
            unknown_date: 'Se incluyeron elementos sin fecha a petición suya; no se puede confirmar su actualidad.',
            date_precision: 'Algunas fuentes indican fechas sin hora; no se puede confirmar la actualidad exacta de 24 horas.',
            partial_feeds: 'Algunas fuentes RSS fallaron; la cobertura es incompleta.',
        },
    },
    it: {
        name: 'Italiano (Italian)',
        facts: 'Sviluppi principali', analysis: 'Analisi IA', sourceDate: 'Pubblicato',
        reported: 'Data riportata (non verificata indipendentemente)', unknown: 'Data di pubblicazione sconosciuta',
        empty: 'Nessuna notizia con fonti nel periodo selezionato.', warning: 'Note sulla qualità', usage: 'Utilizzo API',
        generatedAt: 'Generato alle', processingStatus: 'Stato di Elaborazione',
        issuesIntro: 'Alcuni argomenti hanno riscontrato problemi durante l’elaborazione:', errorRetrieving: 'Errore nel recuperare notizie per',
        warnings: {
            unverified_source: 'Gli elementi con riferimenti a fonti sconosciute sono stati esclusi.',
            outside_window: 'Gli elementi più vecchi o con data futura sono stati esclusi.',
            unknown_date_excluded: 'Gli elementi senza una data di pubblicazione utilizzabile sono stati esclusi.',
            reported_date: 'Alcune date sono state indicate dal modello e non è stato possibile verificarle dai metadati delle fonti.',
            unknown_date: 'Gli elementi senza data sono stati inclusi su richiesta; non è possibile confermarne l’attualità.',
            date_precision: 'Alcune fonti indicano la data senza l’ora; non è possibile confermare l’attualità esatta nelle 24 ore.',
            partial_feeds: 'Alcuni feed RSS non sono stati caricati; la copertura è incompleta.',
        },
    },
    pt: {
        name: 'Português (Portuguese)',
        facts: 'Principais desenvolvimentos', analysis: 'Análise de IA', sourceDate: 'Publicado',
        reported: 'Data indicada (não verificada de forma independente)', unknown: 'Data de publicação desconhecida',
        empty: 'Nenhuma notícia com fontes no período selecionado.', warning: 'Notas de qualidade', usage: 'Uso da API',
        generatedAt: 'Gerado às', processingStatus: 'Status do Processamento',
        issuesIntro: 'Alguns tópicos tiveram problemas durante o processamento:', errorRetrieving: 'Erro ao recuperar notícias para',
        warnings: {
            unverified_source: 'Os itens com referências a fontes desconhecidas foram excluídos.',
            outside_window: 'Os itens antigos ou com data futura foram excluídos.',
            unknown_date_excluded: 'Os itens sem data de publicação utilizável foram excluídos.',
            reported_date: 'Algumas datas foram indicadas pelo modelo e não puderam ser verificadas nos metadados das fontes.',
            unknown_date: 'Itens sem data foram incluídos a seu pedido; não é possível confirmar a sua atualidade.',
            date_precision: 'Algumas fontes indicam datas sem hora; não é possível confirmar a atualidade exata de 24 horas.',
            partial_feeds: 'Alguns feeds RSS falharam; a cobertura está incompleta.',
        },
    },
    zh: {
        name: '中文 (Chinese)',
        facts: '关键动态', analysis: 'AI 分析', sourceDate: '来源发布日期',
        reported: '报道日期（未经独立核验）', unknown: '发布日期不详',
        empty: '所选时间范围内没有符合来源要求的新闻。', warning: '质量说明', usage: 'API 用量',
        generatedAt: '生成时间', processingStatus: '处理状态',
        issuesIntro: '部分主题在处理过程中出现问题：', errorRetrieving: '获取新闻时出错：',
        warnings: {
            unverified_source: '已排除引用未知来源的条目。',
            outside_window: '已排除超出时间范围或日期在未来的条目。',
            unknown_date_excluded: '已排除缺少有效发布日期的条目。',
            reported_date: '部分日期由模型提取，无法通过来源元数据核验。',
            unknown_date: '按设置保留了无日期条目，无法确认其时效性。',
            date_precision: '部分来源只有日期，无法确认是否严格在最近 24 小时内。',
            partial_feeds: '部分 RSS 源获取失败，新闻覆盖不完整。',
        },
    },
};

/** Strings for a language code, falling back to English for unsupported codes. */
export function strings(language: string): Strings {
    return Object.prototype.hasOwnProperty.call(STRINGS, language) ? STRINGS[language] : STRINGS.en;
}
