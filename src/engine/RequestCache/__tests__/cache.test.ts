import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearRequestCache,
    createRequestCacheKey,
    getCachedResponse,
    getOrCreateInFlightRequest,
    setCachedResponse,
} from "..";
import type { ApiResponse } from "../../../types/api";

const response: ApiResponse = { success: true, message: "ok", data: [{ Id: 1 }] };

describe("request cache", () => {
    beforeEach(clearRequestCache);

    it("creates stable keys and distinguishes cache misses from hits", () => {
        const left = createRequestCacheKey("report", { fields: ["Id"], pagination: { pageSize: 25, page: 1 } });
        const right = createRequestCacheKey("report", { pagination: { page: 1, pageSize: 25 }, fields: ["Id"] });
        expect(left).toBe(right);
        expect(getCachedResponse(left)).toBeNull();
        setCachedResponse(left, response);
        expect(getCachedResponse(left)).toBe(response);
    });

    it("expires entries", () => {
        vi.useFakeTimers();
        const key = createRequestCacheKey("report", { id: 1 });
        setCachedResponse(key, response, 10);
        vi.advanceTimersByTime(11);
        expect(getCachedResponse(key)).toBeNull();
        vi.useRealTimers();
    });

    it("deduplicates identical in-flight requests", async () => {
        const create = vi.fn(async () => response);
        const key = "same-request";
        const [first, second] = await Promise.all([
            getOrCreateInFlightRequest(key, create),
            getOrCreateInFlightRequest(key, create),
        ]);
        expect(create).toHaveBeenCalledTimes(1);
        expect(first).toBe(response);
        expect(second).toBe(response);
    });

    it("cancels one consumer without cancelling another consumer", async () => {
        const firstController = new AbortController();
        const secondController = new AbortController();
        let underlyingSignal: AbortSignal | undefined;
        let resolveRequest!: (value: ApiResponse) => void;
        const create = vi.fn((signal: AbortSignal) => {
            underlyingSignal = signal;
            return new Promise<ApiResponse>(resolve => {
                resolveRequest = resolve;
            });
        });

        const first = getOrCreateInFlightRequest("shared", create, firstController.signal);
        const second = getOrCreateInFlightRequest("shared", create, secondController.signal);
        firstController.abort();

        await expect(first).rejects.toMatchObject({ name: "AbortError" });
        expect(underlyingSignal?.aborted).toBe(false);

        resolveRequest(response);
        await expect(second).resolves.toBe(response);
        expect(create).toHaveBeenCalledTimes(1);
    });
});
