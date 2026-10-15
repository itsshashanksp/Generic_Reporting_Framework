import { ApiClientError } from "../../api/client";
import { executeRequest } from "../../api/request";
import type { ApiResponse } from "../../types/api";

/**
 * Rows requested per export batch. The backend refuses a page size above its
 * runtime `maxPageSize` (1000 by default, configurable per deployment), and
 * does not publish that maximum, so a refused first batch is retried with the
 * next smaller of these sizes.
 */
const DEFAULT_EXPORT_BATCH_SIZE = 1000;
const FALLBACK_EXPORT_BATCH_SIZES = [500, 250, 100, 50, 25, 10, 1];
/**
 * Client-side safety limit for "export all": every row is held in browser
 * memory before the file is written. It protects the browser only; the
 * backend still owns pagination limits and authorization.
 */
export const DEFAULT_EXPORT_MAX_ROWS = 100_000;

/** An export was refused because it exceeds the row limit; nothing was saved. */
export class ExportLimitError extends Error {
    readonly rowCount: number;
    readonly maxRows: number;

    constructor(rowCount: number, maxRows: number, exact = true) {
        super(
            `This export has ${exact ? "" : "more than "}${rowCount.toLocaleString()} rows, which exceeds `
            + `the ${maxRows.toLocaleString()}-row export limit. Narrow the filters and try again.`
        );
        this.name = "ExportLimitError";
        this.rowCount = rowCount;
        this.maxRows = maxRows;
    }
}

/** Throws when a known row count exceeds the export limit. */
export function assertWithinExportLimit(rowCount: number, maxRows = DEFAULT_EXPORT_MAX_ROWS): void {
    if (rowCount > maxRows) throw new ExportLimitError(rowCount, maxRows);
}

type RequestExecutor = (
    request: object,
    options?: RequestInit
) => Promise<ApiResponse>;

interface FetchAllRowsOptions {
    signal?: AbortSignal;
    batchSize?: number;
    maxRows?: number;
    onProgress?: (loadedRows: number, totalRows: number | null) => void;
    execute?: RequestExecutor;
}

export async function fetchAllRowsForExport(
    request: object,
    {
        signal,
        batchSize = DEFAULT_EXPORT_BATCH_SIZE,
        maxRows = DEFAULT_EXPORT_MAX_ROWS,
        onProgress,
        execute = executeRequest,
    }: FetchAllRowsOptions = {}
): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let page = 1;
    let totalRows: number | null = null;
    const smallerBatchSizes = FALLBACK_EXPORT_BATCH_SIZES.filter(size => size < batchSize);

    while (totalRows === null || rows.length < totalRows) {
        let response: ApiResponse;
        try {
            response = await execute(
                { ...request, pagination: { page, pageSize: batchSize } },
                { signal }
            );
        } catch (error: unknown) {
            // Only the first batch may be retried, before any row is held.
            if (page === 1 && isPageSizeRefusal(error) && smallerBatchSizes.length > 0) {
                batchSize = smallerBatchSizes.shift()!;
                continue;
            }
            throw error;
        }

        if (!response.success) {
            throw new Error(response.message || "The data service could not prepare the export.");
        }

        const pageRows = response.data ?? [];
        totalRows = response.meta?.totalRows ?? totalRows;
        // Refuse before downloading further batches when the size is known.
        if (totalRows !== null) assertWithinExportLimit(totalRows, maxRows);
        rows.push(...pageRows);
        if (rows.length > maxRows) throw new ExportLimitError(maxRows, maxRows, false);
        onProgress?.(rows.length, totalRows);

        if (pageRows.length === 0) {
            if (totalRows !== null && rows.length < totalRows) {
                throw new Error("The data service returned an incomplete export result.");
            }
            break;
        }

        if (pageRows.length < batchSize) {
            if (totalRows !== null && rows.length < totalRows) {
                throw new Error("The data service returned an incomplete export result.");
            }
            break;
        }

        page += 1;
    }

    return totalRows === null ? rows : rows.slice(0, totalRows);
}

/** The backend refused the request only because the page size exceeds its maximum. */
function isPageSizeRefusal(error: unknown): boolean {
    return error instanceof ApiClientError
        && error.status === 400
        && error.code === "INVALID_REQUEST"
        && error.details.length > 0
        && error.details.every(detail => typeof detail === "object" && detail.path === "pagination.pageSize");
}

export const exportRequestPolicy = {
    batchSize: DEFAULT_EXPORT_BATCH_SIZE,
    maxRows: DEFAULT_EXPORT_MAX_ROWS,
} as const;
