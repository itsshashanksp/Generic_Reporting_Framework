import { ApiClientError, apiClient } from "./client";

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

/** fetch() rejects with a TypeError whose message differs per runtime. */
const NETWORK_FAILURE_MESSAGE = /^(?:Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|fetch failed)$/i;
const PROGRAMMING_ERRORS = [TypeError, ReferenceError, RangeError, SyntaxError, EvalError, URIError];

export function isNetworkError(error: unknown): boolean {
    return error instanceof TypeError && NETWORK_FAILURE_MESSAGE.test(error.message.trim());
}

export function getRequestErrorMessage(
    error: unknown,
    fallback = "An unexpected error occurred while loading data."
) {
    if (isNetworkError(error)) {
        return "The data service could not be reached. Check the network connection and try again.";
    }

    // A local programming error is neither a network failure nor a message
    // meant for users; show the caller's fallback instead of internals.
    if (PROGRAMMING_ERRORS.some(type => error instanceof type)) {
        return fallback;
    }

    if (error instanceof ApiClientError) {
        // Validation details name the field and what is wrong with it, e.g.
        // "pagination.pageSize: Page size exceeds the configured maximum."
        const details = error.details.flatMap(detail =>
            typeof detail === "object" && detail.path && detail.message ? [`${detail.path}: ${detail.message}`] : []);
        const safeMessage = error.code === "INVALID_SQL_RUNTIME_FILTER"
            ? "The SQL Resource could not combine these runtime filters."
            : error.code === "INVALID_SQL_RUNTIME_FIELD"
                ? "The SQL Resource does not allow one of the requested filter fields."
                : error.message || fallback;
        return [safeMessage, ...new Set(details)].join(" ");
    }

    if (error instanceof Error) {
        return error.message || fallback;
    }

    return fallback;
}
