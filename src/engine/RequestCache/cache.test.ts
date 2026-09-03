import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRequestCache, createRequestCacheKey, getCachedResponse, requestCachePolicy, setCachedResponse } from "./cache";

const response = { success: true, message: "ok", data: [{ id: 1 }], rowsReturned: 1 };

describe("request cache", () => {
    beforeEach(() => {
        clearRequestCache();
        vi.useRealTimers();
    });

    it("creates stable keys while distinguishing request state", () => {
        expect(createRequestCacheKey("report:a", { page: 1, filters: { name: "Ada" } }))
            .toBe(createRequestCacheKey("report:a", { filters: { name: "Ada" }, page: 1 }));
        expect(createRequestCacheKey("report:a", { page: 1 }))
            .not.toBe(createRequestCacheKey("report:a", { page: 2 }));
        expect(createRequestCacheKey("widget:a", { page: 1 }))
            .not.toBe(createRequestCacheKey("widget:b", { page: 1 }));
    });

    it("expires entries after their TTL", () => {
        vi.useFakeTimers();
        const key = createRequestCacheKey("report:a", { page: 1 });
        setCachedResponse(key, response, 1000);
        expect(getCachedResponse(key)).toEqual(response);
        vi.advanceTimersByTime(1001);
        expect(getCachedResponse(key)).toBeNull();
    });

    it("bounds cache growth", () => {
        for (let index = 0; index <= requestCachePolicy.maxEntries; index += 1) {
            setCachedResponse(`key-${index}`, response);
        }
        expect(getCachedResponse("key-0")).toBeNull();
        expect(getCachedResponse(`key-${requestCachePolicy.maxEntries}`)).toEqual(response);
    });

    it("distinguishes filters and search state", () => {
        expect(createRequestCacheKey("report:a", { where: [{ value: "Ada" }] }))
            .not.toBe(createRequestCacheKey("report:a", { where: [{ value: "Grace" }] }));
    });

    it("distinguishes sorting and page-size state", () => {
        expect(createRequestCacheKey("report:a", { sort: [{ column: "name", direction: "ASC" }], pageSize: 10 }))
            .not.toBe(createRequestCacheKey("report:a", { sort: [{ column: "name", direction: "DESC" }], pageSize: 25 }));
    });
});
