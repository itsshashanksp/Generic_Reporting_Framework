/**
 * Dashboard runtime database: a widget request that names no `database`
 * inherits the dashboard selection; a widget's own `database` always wins.
 */
export function inheritDashboardDatabase<T extends object>(request: T, database: string | undefined): T {
    if (!database || "database" in request && (request as { database?: unknown }).database !== undefined) return request;
    return { ...request, database };
}

export function requestInheritsDatabase(request: object | undefined): boolean {
    return request !== undefined && (request as { database?: unknown }).database === undefined;
}
