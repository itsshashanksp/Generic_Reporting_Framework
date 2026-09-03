import { apiClient } from "./client";

import type { ApiResponse } from "../types/api";

export async function executeRequest(
    request: object,
    options?: RequestInit
): Promise<ApiResponse> {
    return apiClient(request, options);
}

export function isRequestAbort(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
}

export function getRequestErrorMessage(
    error: unknown,
    fallback = "An unexpected error occurred while loading data."
) {
    if (error instanceof Error) {
        if (error.name === "TypeError") {
            return "The data service could not be reached. Check the network connection and try again.";
        }

        return error.message || fallback;
    }

    return fallback;
}
