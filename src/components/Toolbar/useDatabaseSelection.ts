import { useCallback, useState } from "react";
import { useDatabaseRegistry } from "../../engine/DatabaseContext";
import type { DatabaseOption } from "../../engine/DatabaseContext";
export type { DatabaseOption } from "../../engine/DatabaseContext";

export type DatabaseSelectionStatus =
    /** No `databaseSelection`: requests keep their configured database. */
    | "off"
    /** The registry listing is loading; nothing may be requested yet. */
    | "loading"
    /** `database` is set and may be requested. */
    | "ready"
    /** Discovery failed or was denied; no database may be requested. */
    | "listing-failed"
    /** No authorized database is enabled and available. */
    | "empty";

export interface DatabaseSelection {
    status: DatabaseSelectionStatus;
    /** The database to request; "" whenever status is not "ready". */
    database: string;
    options: DatabaseOption[];
    /** Listing failure message, for "listing-failed". */
    error: string;
    select: (database: string) => void;
    retry: () => void;
}

/**
 * Shared report/dashboard database selection. The backend registry
 * (`metadata.databases`) is the source of truth for the default:
 *
 * 1. Options: every authorized registry row that is enabled; unavailable rows
 *    are shown but cannot be chosen.
 * 2. Initial selection: an authorized configured/global default when supplied,
 *    then the registry default, then the first enabled and available row.
 * 3. A failed or denied listing has no fallback options and sends no data
 *    request. Frontend configuration is never treated as authorization.
 *
 * `scopeKey` (the report or dashboard id) resets the user's choice.
 */
export function useDatabaseSelection(scopeKey: string, enabled: boolean, initialDatabase = ""): DatabaseSelection {
    const registry = useDatabaseRegistry(enabled);
    const [choice, setChoice] = useState<{ scopeKey: string; database: string } | null>(null);
    const chosen = choice?.scopeKey === scopeKey && registry.usable.includes(choice.database) ? choice.database : "";
    const configured = registry.usable.includes(initialDatabase) ? initialDatabase : "";
    const database = chosen || configured || registry.fallback;
    const status: DatabaseSelectionStatus = !enabled
        ? "off"
        : registry.status === "loading"
            ? "loading"
            : database
                ? "ready"
                : registry.status === "failed" ? "listing-failed" : "empty";

    const select = useCallback((next: string) => {
        if (registry.usable.includes(next)) setChoice({ scopeKey, database: next });
    }, [registry.usable, scopeKey]);

    return {
        status,
        database: status === "ready" ? database : "",
        options: registry.options,
        error: registry.error,
        select,
        retry: registry.retry,
    };
}
