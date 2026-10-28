import { useCallback, useEffect, useState } from "react";
import { useDatabaseRegistry } from "../../engine/DatabaseContext";
import type { DatabaseOption } from "../../engine/DatabaseContext";
import { readPageDatabaseSelection, removePageDatabaseSelection, savePageDatabaseSelection } from "../../engine/DatabaseContext/pageDatabaseSession";
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
 * `scopeKey` includes the page kind and stable id, so report/dashboard ids
 * cannot collide. Choices are bound to the current authenticated session.
 */
export function useDatabaseSelection(scopeKey: string, enabled: boolean, initialDatabase = ""): DatabaseSelection {
    const registry = useDatabaseRegistry(enabled);
    const [, refreshStoredChoice] = useState(0);
    const stored = enabled ? readPageDatabaseSelection(scopeKey) : "";
    const chosen = registry.usable.includes(stored) ? stored : "";
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
        if (registry.usable.includes(next)) {
            savePageDatabaseSelection(scopeKey, next);
            refreshStoredChoice(value => value + 1);
        }
    }, [registry.usable, scopeKey]);

    useEffect(() => {
        if (enabled && registry.status === "ready" && stored && !registry.usable.includes(stored)) {
            removePageDatabaseSelection(scopeKey);
        }
    }, [enabled, registry.status, registry.usable, scopeKey, stored]);

    return {
        status,
        database: status === "ready" ? database : "",
        options: registry.options,
        error: registry.error,
        select,
        retry: registry.retry,
    };
}
