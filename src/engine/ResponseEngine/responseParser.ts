import type { ApiResponse } from "../../types/api";

export function parseResponse(
    response: ApiResponse | null | undefined
) {

    if (!response?.success) {
        return {
            rows: [],
            columns: []
        };
    }

    const rows = response.data ?? [];

    return {
        rows,
    };
}
