import { executeRequest } from "../../api/request";
import type { ApiResponse } from "../../types/api";

const DEFAULT_EXPORT_BATCH_SIZE = 5000;

type RequestExecutor = (
    request: object,
    options?: RequestInit
) => Promise<ApiResponse>;

interface FetchAllRowsOptions {
    signal?: AbortSignal;
    batchSize?: number;
    onProgress?: (loadedRows: number, totalRows: number | null) => void;
    execute?: RequestExecutor;
}

export async function fetchAllRowsForExport(
    request: object,
    {
        signal,
        batchSize = DEFAULT_EXPORT_BATCH_SIZE,
        onProgress,
        execute = executeRequest,
    }: FetchAllRowsOptions = {}
): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let page = 1;
    let totalRows: number | null = null;

    while (totalRows === null || rows.length < totalRows) {
        const response = await execute(
            { ...request, page, pageSize: batchSize },
            { signal }
        );

        if (!response.success) {
            throw new Error(response.message || "The data service could not prepare the export.");
        }

        const pageRows = response.data ?? [];
        rows.push(...pageRows);
        totalRows = response.totalRows ?? totalRows;
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
} as const;
