// Real Node HTTP transport for the optional RSS smoke test; production uses Obsidian.
export async function requestUrl(options: { url: string; method?: string; headers?: Record<string, string>; body?: string }) {
    const response = await fetch(options.url, {
        method: options.method, headers: options.headers, body: options.body,
        signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    return { status: response.status, text, get json() { return JSON.parse(text); } };
}
