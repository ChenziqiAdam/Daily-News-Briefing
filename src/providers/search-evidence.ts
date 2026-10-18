/** Reject successful text-only responses when a news pipeline requires live retrieval. */
export function requireOpenAISearch(response: { output: Array<{ type: string; status?: string }> }): void {
    if (!response.output.some(item => item.type === 'web_search_call' && item.status === 'completed')) {
        throw new Error('Web search did not complete. Please check model/tool access and quota.');
    }
}

export function requireGeminiSearch(response: { candidates?: Array<{ groundingMetadata?: { webSearchQueries?: string[] } }> }): void {
    if (!response.candidates?.some(candidate => candidate.groundingMetadata?.webSearchQueries?.length)) {
        throw new Error('Google Search grounding was not performed. Check Search access and quota; newer models require billing. For free summaries, use RSS + Gemini.');
    }
}

export function requireOpenRouterSearch(response: unknown): void {
    const result = response as {
        usage?: { server_tool_use?: { web_search_requests?: number } };
        choices?: Array<{ message?: { annotations?: Array<{ type: string }> } }>;
    };
    const searched = (result.usage?.server_tool_use?.web_search_requests ?? 0) > 0;
    const cited = result.choices?.some(choice => choice.message?.annotations?.some(a => a.type === 'url_citation'));
    if (!searched && !cited) throw new Error('OpenRouter returned no search evidence. Check server-tool access, model compatibility and credits.');
}
