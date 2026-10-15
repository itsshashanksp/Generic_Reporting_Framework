import { executeRequest } from "../../api/request";
import type { ApiResponse } from "../../types/api";

const DEFAULT_EXPORT_BATCH_SIZE = 5000;
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

    while (totalRows === null || rows.length < totalRows) {
        const response = await execute(
            { ...request, pagination: { page, pageSize: batchSize } },
            { signal }
        );

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

export const exportRequestPolicy = {
    batchSize: DEFAULT_EXPORT_BATCH_SIZE,
    maxRows: DEFAULT_EXPORT_MAX_ROWS,
} as const;
