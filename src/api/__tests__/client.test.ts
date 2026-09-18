import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, apiClient } from "../client";

describe("apiClient", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("accepts the backend standard query response", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            success: true,
            message: "Data Loaded Successfully",
            data: [{ Item_Code: "A1" }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 2.4 },
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(apiClient({ action: "sql", resource: "reports/item" })).resolves.toMatchObject({ success: true });
        expect(fetchMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            credentials: "same-origin",
        }));
    });

    it("preserves backend error code, details, and status", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            success: false,
            message: "Invalid request.",
            error: { code: "INVALID_REQUEST", details: [{ path: "pagination.page", message: "Must be positive." }] },
            data: [],
        }), { status: 400, headers: { "Content-Type": "application/json" } })));

        const error = await apiClient({ action: "select" }).catch(caught => caught);
        expect(error).toBeInstanceOf(ApiClientError);
        expect(error).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
        expect((error as ApiClientError).details[0]).toMatchObject({ path: "pagination.page" });
    });
});
