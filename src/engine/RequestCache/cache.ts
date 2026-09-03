import type { ApiResponse } from "../../types/api";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 100;

interface CacheEntry {
    response: ApiResponse;
    expiresAt: number;
    lastAccessedAt: number;
}

const cache = new Map<string, CacheEntry>();

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

export function clearRequestCache() {
    cache.clear();
}

export const requestCachePolicy = {
    ttlMs: DEFAULT_TTL_MS,
    maxEntries: MAX_ENTRIES,
} as const;
