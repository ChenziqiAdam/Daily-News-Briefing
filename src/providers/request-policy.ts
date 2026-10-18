import { requestUrl } from 'obsidian';

/** One bounded retry for explicit throttling or server failures; never retry auth/validation errors. */
export async function retryRequest<T>(request: () => Promise<T>, retries: number, wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try { return await request(); } catch (error) {
            const detail = (error && typeof error === 'object' ? error : {}) as { status?: number; headers?: { get?: (key: string) => string | null } };
            const status = detail.status;
            if (attempt >= retries || (status !== 429 && !(status && status >= 500))) throw error;
            const headers = detail.headers;
            const seconds = Number(headers?.get?.('retry-after'));
            const delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : 500 * 2 ** attempt;
            await wait(delay);
        }
    }
}

/** Obsidian's transport has no cancellation API: timeout stops waiting, not server billing. */
export async function requestJson(options: import('obsidian').RequestUrlParam, settings: import('../types').DailyNewsSettings): Promise<unknown> {
    return retryRequest(async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                requestUrl({ ...options, throw: false }).then(response => {
                    if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(`HTTP ${response.status}: request failed`), { status: response.status });
                    return response.json as unknown;
                }),
                new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out; the server may still complete it.')), Math.max(10, Math.min(300, settings.requestTimeoutSeconds)) * 1000); }),
            ]);
        } finally { if (timer) clearTimeout(timer); }
    }, Math.max(0, Math.min(2, settings.requestRetries)));
}

