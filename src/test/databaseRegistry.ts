import type { ApiResponse } from "../types/api";

/**
 * A backend registry for tests that render the checked-in reports and
 * dashboards, several of which enable `databaseSelection`. Mirrors the
 * `metadata.databases` row shape; `loyal-ibms` is the registry default.
 */
export const TEST_DATABASE_REGISTRY = [
    { id: "loyal-ibms", name: "loyal-ibms", default: true, enabled: true, available: true, crossDatabaseGroup: "test" },
    { id: "loyal-ibms2", name: "loyal-ibms2", default: false, enabled: true, available: true, crossDatabaseGroup: "test" },
];

export function databaseRegistryResponse(registry: Record<string, unknown>[] = TEST_DATABASE_REGISTRY): ApiResponse {
    return {
        success: true,
        message: "Databases Loaded Successfully",
        data: registry,
        meta: { page: null, pageSize: null, totalRows: registry.length, rowsReturned: registry.length, executionTime: 1 },
    };
}

/**
 * Wraps a test's `executeRequest` mock: `metadata.databases` is answered from
 * the test registry, every other request reaches the mock (whose call counts
 * therefore stay unchanged).
 */
export function withTestDatabaseRegistry<T extends (request: object, options?: RequestInit) => unknown>(execute: T) {
    return (request: object, options?: RequestInit) =>
        (request as { action?: unknown }).action === "metadata.databases"
            ? Promise.resolve(databaseRegistryResponse())
            : execute(request, options);
}
