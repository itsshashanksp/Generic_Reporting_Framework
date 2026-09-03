import type { ApiResponse } from "../types/api";

const API_URL = import.meta.env.VITE_API_URL;

export async function apiClient(
    body: object,
    options: RequestInit = {}
): Promise<ApiResponse> {
    const response = await fetch(API_URL, {
        ...options,
        method: "POST",
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    let payload: unknown;

    try {
        payload = await response.json();
    } catch {
        throw new Error(
            response.ok
                ? "The API returned an invalid JSON response."
                : `The API returned HTTP ${response.status}.`
        );
    }

    if (!response.ok) {
        const message =
            typeof payload === "object"
            && payload !== null
            && "message" in payload
            && typeof payload.message === "string"
                ? payload.message
                : `The API returned HTTP ${response.status}.`;

        throw new Error(message);
    }

    if (
        typeof payload !== "object"
        || payload === null
        || !("success" in payload)
        || typeof payload.success !== "boolean"
    ) {
        throw new Error("The API returned an unexpected response format.");
    }

    if (
        payload.success
        && (
            !("data" in payload)
            || !Array.isArray(payload.data)
            || !payload.data.every(
                row => typeof row === "object" && row !== null && !Array.isArray(row)
            )
        )
    ) {
        throw new Error("The API returned an unexpected data format.");
    }

    return payload as ApiResponse;
}
