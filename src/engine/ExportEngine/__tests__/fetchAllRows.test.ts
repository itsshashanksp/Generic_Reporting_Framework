import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../api/client";

import {
    assertWithinExportLimit,
    DEFAULT_EXPORT_MAX_ROWS,
    ExportLimitError,
    exportRequestPolicy,
    fetchAllRowsForExport,
} from "../fetchAllRows";

function page(rows: number, totalRows: number | null) {
    return {
        success: true,
        message: "ok",
        data: Array.from({ length: rows }, (_, index) => ({ Id: index })),
        meta: { page: 1, pageSize: rows, totalRows: totalRows as number, rowsReturned: rows, executionTime: 1 },
    };
}

describe("export-all row limit", () => {
    it("documents a 100,000-row default", () => {
        expect(DEFAULT_EXPORT_MAX_ROWS).toBe(100_000);
        expect(exportRequestPolicy.maxRows).toBe(DEFAULT_EXPORT_MAX_ROWS);
    });

    it("refuses after the first batch when the reported total exceeds the limit", async () => {
        const execute = vi.fn().mockResolvedValue(page(2, 7));

        const error = await fetchAllRowsForExport({ action: "sql" }, { batchSize: 2, maxRows: 5, execute }).catch(caught => caught);

        expect(error).toBeInstanceOf(ExportLimitError);
        expect(error.message).toBe("This export has 7 rows, which exceeds the 5-row export limit. Narrow the filters and try again.");
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("refuses as soon as rows exceed the limit when no total is reported", async () => {
        const execute = vi.fn().mockResolvedValue(page(2, null));

        const error = await fetchAllRowsForExport({ action: "sql" }, { batchSize: 2, maxRows: 5, execute }).catch(caught => caught);

        expect(error).toBeInstanceOf(ExportLimitError);
        expect(error.message).toContain("more than 5 rows");
        expect(execute).toHaveBeenCalledTimes(3);
    });

    it("exports everything at exactly the limit", async () => {
        const execute = vi.fn()
            .mockResolvedValueOnce(page(2, 5))
            .mockResolvedValueOnce(page(2, 5))
            .mockResolvedValueOnce(page(1, 5));

        const rows = await fetchAllRowsForExport({ action: "sql" }, { batchSize: 2, maxRows: 5, execute });

        expect(rows).toHaveLength(5);
    });

    it("keeps the default limit for normal exports", async () => {
        const execute = vi.fn().mockResolvedValue(page(3, 3));
        await expect(fetchAllRowsForExport({ action: "sql" }, { execute })).resolves.toHaveLength(3);
    });

    it("checks single-response exports with the same limit", () => {
        expect(() => assertWithinExportLimit(DEFAULT_EXPORT_MAX_ROWS)).not.toThrow();
        expect(() => assertWithinExportLimit(DEFAULT_EXPORT_MAX_ROWS + 1)).toThrow(ExportLimitError);
    });

    describe("at the default 100,000-row limit with 1,000-row batches", () => {
        /** Serves `available` rows in pages; `reportTotal` false omits meta.totalRows. */
        function server(available: number, reportTotal = true) {
            let largestHeld = 0;
            const execute = vi.fn().mockImplementation(async (request: { pagination: { page: number; pageSize: number } }) => {
                const { page: pageNumber, pageSize } = request.pagination;
                const count = Math.max(0, Math.min(pageSize, available - (pageNumber - 1) * pageSize));
                return page(count, reportTotal ? available : null);
            });
            const onProgress = (loaded: number) => { largestHeld = Math.max(largestHeld, loaded); };
            return { execute, onProgress, largestHeld: () => largestHeld };
        }

        it("permits exactly 100,000 rows without an extra request", async () => {
            const { execute, onProgress } = server(100_000);
            await expect(fetchAllRowsForExport({ action: "sql" }, { execute, onProgress })).resolves.toHaveLength(100_000);
            expect(execute).toHaveBeenCalledTimes(100);
        });

        it("rejects a reported 100,001 rows after the first batch", async () => {
            const { execute, onProgress } = server(100_001);
            await expect(fetchAllRowsForExport({ action: "sql" }, { execute, onProgress })).rejects.toThrow(
                "This export has 100,001 rows, which exceeds the 100,000-row export limit."
            );
            expect(execute).toHaveBeenCalledTimes(1);
        });

        it("permits exactly 100,000 unreported rows, confirmed by one empty page", async () => {
            const { execute, onProgress } = server(100_000, false);
            await expect(fetchAllRowsForExport({ action: "sql" }, { execute, onProgress })).resolves.toHaveLength(100_000);
            expect(execute).toHaveBeenCalledTimes(101);
        });

        it("stops unreported exports one batch past the limit without holding more rows", async () => {
            const { execute, onProgress, largestHeld } = server(1_000_000, false);
            await expect(fetchAllRowsForExport({ action: "sql" }, { execute, onProgress })).rejects.toThrow(
                "This export has more than 100,000 rows"
            );
            expect(execute).toHaveBeenCalledTimes(101);
            expect(largestHeld()).toBeLessThanOrEqual(100_000);
        });
    });

    describe("batch boundaries and failures", () => {
        it("stops at a total that is an exact multiple of the batch size", async () => {
            const execute = vi.fn().mockResolvedValueOnce(page(5, 10)).mockResolvedValueOnce(page(5, 10));
            await expect(fetchAllRowsForExport({ action: "sql" }, { batchSize: 5, execute })).resolves.toHaveLength(10);
            expect(execute).toHaveBeenCalledTimes(2);
        });

        it("rejects when a later batch fails, without returning partial rows", async () => {
            const execute = vi.fn().mockResolvedValueOnce(page(5, 12)).mockRejectedValueOnce(new Error("The API returned HTTP 502."));
            await expect(fetchAllRowsForExport({ action: "sql" }, { batchSize: 5, execute })).rejects.toThrow("HTTP 502");
        });

        it("rejects an unsuccessful batch response", async () => {
            const execute = vi.fn().mockResolvedValueOnce(page(5, 12)).mockResolvedValueOnce({ ...page(0, 12), success: false, message: "Query failed." });
            await expect(fetchAllRowsForExport({ action: "sql" }, { batchSize: 5, execute })).rejects.toThrow("Query failed.");
        });

        it.each([[3], [0]])("rejects a short batch (%i rows) before the reported total as incomplete", async rowsInSecondBatch => {
            const execute = vi.fn().mockResolvedValueOnce(page(5, 12)).mockResolvedValueOnce(page(rowsInSecondBatch, 12));
            await expect(fetchAllRowsForExport({ action: "sql" }, { batchSize: 5, execute })).rejects.toThrow(
                "The data service returned an incomplete export result."
            );
        });
    });
});

describe("export batch size and the backend page-size maximum", () => {
    const pageSizeRefusal = () => new ApiClientError("Invalid request.", 400, {
        code: "INVALID_REQUEST",
        details: [{ path: "pagination.pageSize", message: "Page size exceeds the configured maximum." }],
    });
    /** A backend that refuses page sizes above `maxPageSize` and holds `available` rows. */
    function backend(maxPageSize: number, available: number) {
        return vi.fn().mockImplementation(async (request: { pagination: { page: number; pageSize: number } }) => {
            const { page: pageNumber, pageSize } = request.pagination;
            if (pageSize > maxPageSize) throw pageSizeRefusal();
            return page(Math.max(0, Math.min(pageSize, available - (pageNumber - 1) * pageSize)), available);
        });
    }
    const sizes = (execute: ReturnType<typeof vi.fn>) => execute.mock.calls.map(call => call[0].pagination.pageSize);

    it("requests 1,000 rows per batch by default, within the backend's default maximum", async () => {
        const execute = backend(1000, 1_500);
        await expect(fetchAllRowsForExport({ action: "sql" }, { execute })).resolves.toHaveLength(1_500);
        expect(exportRequestPolicy.batchSize).toBe(1000);
        expect(sizes(execute)).toEqual([1000, 1000]);
    });

    it("retries a refused first batch with smaller sizes and keeps the accepted size", async () => {
        const execute = backend(100, 250);
        const rows = await fetchAllRowsForExport({ action: "sql", resource: "widgets/bill-purchases-month-wise" }, { execute });
        expect(rows).toHaveLength(250);
        expect(sizes(execute)).toEqual([1000, 500, 250, 100, 100, 100]);
        expect(execute.mock.calls.map(call => call[0].pagination.page)).toEqual([1, 1, 1, 1, 2, 3]);
        expect(execute.mock.calls.every(call => call[0].resource === "widgets/bill-purchases-month-wise")).toBe(true);
    });

    it("does not retry other invalid requests", async () => {
        const invalid = new ApiClientError("Invalid request.", 400, {
            code: "INVALID_REQUEST",
            details: [{ path: "filters.0.field", message: "Unknown field." }],
        });
        const execute = vi.fn().mockRejectedValue(invalid);
        await expect(fetchAllRowsForExport({ action: "sql" }, { execute })).rejects.toBe(invalid);
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("does not retry a page-size refusal after rows were received", async () => {
        const refusal = pageSizeRefusal();
        const execute = vi.fn()
            .mockResolvedValueOnce(page(1000, 3_000))
            .mockRejectedValueOnce(refusal);
        await expect(fetchAllRowsForExport({ action: "sql" }, { execute })).rejects.toBe(refusal);
        expect(sizes(execute)).toEqual([1000, 1000]);
    });

    it("reports the refusal when even one-row batches are refused", async () => {
        const execute = backend(0, 10);
        await expect(fetchAllRowsForExport({ action: "sql" }, { execute })).rejects.toThrow("Invalid request.");
        expect(sizes(execute)).toEqual([1000, 500, 250, 100, 50, 25, 10, 1]);
    });
});
