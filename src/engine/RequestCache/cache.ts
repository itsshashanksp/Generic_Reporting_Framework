import type { ApiResponse } from "../../types/api";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 100;

interface CacheEntry {
    response: ApiResponse;
    expiresAt: number;
    lastAccessedAt: number;
}

const cache = new Map<string, CacheEntry>();
interface InFlightEntry {
    controller: AbortController;
    consumers: Set<symbol>;
    promise: Promise<ApiResponse>;
    abortTimer?: ReturnType<typeof setTimeout>;
}

const inFlightRequests = new Map<string, InFlightEntry>();

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }

    if (typeof value === "object" && value !== null) {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, item]) => item !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, stableValue(item)])
        );
    }

    return value;
}

export function createRequestCacheKey(scope: string, request: object) {
    return `${scope}:${JSON.stringify(stableValue(request))}`;
}

export function getCachedResponse(key: string): ApiResponse | null {
    const entry = cache.get(key);

    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }

    entry.lastAccessedAt = Date.now();
    return entry.response;
}

export function setCachedResponse(
    key: string,
    response: ApiResponse,
    ttlMs = DEFAULT_TTL_MS
) {
    const now = Date.now();
    cache.set(key, {
        response,
        expiresAt: now + ttlMs,
        lastAccessedAt: now,
    });

    if (cache.size <= MAX_ENTRIES) {
        return;
    }

    const oldest = [...cache.entries()].reduce((candidate, entry) =>
        entry[1].lastAccessedAt < candidate[1].lastAccessedAt ? entry : candidate
    );
    cache.delete(oldest[0]);
}

/**
 * Share an exact request which is already in progress. The caller still owns
 * its AbortController; this layer only makes request identity reusable across
 * report and dashboard consumers.
 */
export function getOrCreateInFlightRequest(
    key: string,
    createRequest: (signal: AbortSignal) => Promise<ApiResponse>,
    callerSignal?: AbortSignal
): Promise<ApiResponse> {
    let entry = inFlightRequests.get(key);
    if (!entry) {
        const controller = new AbortController();
        const request = createRequest(controller.signal);
        entry = { controller, consumers: new Set(), promise: request };
        inFlightRequests.set(key, entry);
        void request.finally(() => {
            if (inFlightRequests.get(key)?.promise === request) {
                inFlightRequests.delete(key);
            }
        }).catch(() => {
            // The subscribed callers observe the rejection. This only handles
            // the promise returned by finally so it cannot become unhandled.
        });
    }

    if (entry.abortTimer) {
        clearTimeout(entry.abortTimer);
        entry.abortTimer = undefined;
    }

    const consumer = Symbol(key);
    entry.consumers.add(consumer);

    return new Promise<ApiResponse>((resolve, reject) => {
        let settled = false;

        const release = () => {
            entry.consumers.delete(consumer);
            callerSignal?.removeEventListener("abort", handleAbort);
            if (entry.consumers.size === 0 && inFlightRequests.get(key) === entry) {
                entry.abortTimer = setTimeout(() => {
                    if (entry.consumers.size === 0 && inFlightRequests.get(key) === entry) {
                        entry.controller.abort();
                    }
                }, 0);
            }
        };
        const handleAbort = () => {
            if (settled) return;
            settled = true;
            release();
            reject(new DOMException("The request was aborted.", "AbortError"));
        };

        if (callerSignal?.aborted) {
            handleAbort();
            return;
        }
        callerSignal?.addEventListener("abort", handleAbort, { once: true });

        entry.promise.then(
            response => {
                if (settled) return;
                settled = true;
                release();
                resolve(response);
            },
            error => {
                if (settled) return;
                settled = true;
                release();
                reject(error);
            }
        );
    });
}

export function clearRequestCache() {
    cache.clear();
    inFlightRequests.clear();
}

export const requestCachePolicy = {
    ttlMs: DEFAULT_TTL_MS,
    maxEntries: MAX_ENTRIES,
} as const;
