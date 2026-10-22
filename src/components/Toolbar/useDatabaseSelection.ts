import { useCallback, useEffect, useMemo, useState } from "react";

import { executeRequest, getRequestErrorMessage, isRequestAbort } from "../../api/request";
import {
    createRequestCacheKey,
    getCachedResponse,
    getOrCreateInFlightRequest,
    setCachedResponse,
} from "../../engine/RequestCache";
import type { ApiResponse } from "../../types/api";

export interface DatabaseOption {
    id: string;
    label: string;
    /** Registered and enabled, but its availability gate is closed. */
    disabled: boolean;
}

/** One `metadata.databases` row: logical registry data only, never connection details. */
interface RegisteredDatabase {
    id: string;
    name: string;
    default: boolean;
    enabled: boolean;
    available: boolean;
}

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

const LISTING_REQUEST = { action: "metadata.databases" } as const;
const LISTING_CACHE_KEY = createRequestCacheKey("metadata-databases", LISTING_REQUEST);

type Listing =
    | { status: "loading" }
    | { status: "loaded"; databases: RegisteredDatabase[] }
    | { status: "failed"; error: string };

/**
 * Shared report/dashboard database selection. The backend registry
 * (`metadata.databases`) is the source of truth for the default:
 *
 * 1. Options: every authorized registry row that is enabled; unavailable rows
 *    are shown but cannot be chosen.
 * 2. Initial selection: the authorized registry default when available;
 *    otherwise the first authorized, enabled and available row; otherwise none.
 * 3. A failed or denied listing has no fallback options and sends no data
 *    request. Frontend configuration is never treated as authorization.
 *
 * `scopeKey` (the report or dashboard id) resets the user's choice.
 */
export function useDatabaseSelection(scopeKey: string, enabled: boolean): DatabaseSelection {
    const [listing, setListing] = useState<Listing>(initialListing);
    const [attempt, setAttempt] = useState(0);
    const [choice, setChoice] = useState<{ scopeKey: string; database: string } | null>(null);

    useEffect(() => {
        if (!enabled || listing.status !== "loading") return;
        const controller = new AbortController();
        void getOrCreateInFlightRequest(
            LISTING_CACHE_KEY,
            signal => executeRequest(LISTING_REQUEST, { signal }),
            controller.signal
        ).then(response => {
            const databases = parseListing(response);
            setCachedResponse(LISTING_CACHE_KEY, response);
            setListing({ status: "loaded", databases });
        }).catch((error: unknown) => {
            if (!isRequestAbort(error)) {
                setListing({ status: "failed", error: getRequestErrorMessage(error, "The database list could not be loaded.") });
            }
        });
        return () => controller.abort();
    }, [enabled, listing.status, attempt]);

    const resolved = useMemo(() => {
        if (!enabled || listing.status === "failed") return { options: [] as DatabaseOption[], usable: [] as string[], fallback: "" };
        if (listing.status !== "loaded") return { options: [], usable: [], fallback: "" };
        const registered = listing.databases.filter(database => database.enabled);
        const usable = registered.filter(entry => entry.available).map(entry => entry.id);
        const backendDefault = listing.databases.find(database => database.default)?.id;
        return {
            options: registered.map(entry => ({
                id: entry.id,
                label: entry.available ? entry.name || entry.id : `${entry.name || entry.id} (unavailable)`,
                disabled: !entry.available,
            })),
            usable,
            fallback: backendDefault && usable.includes(backendDefault) ? backendDefault : usable[0] ?? "",
        };
    }, [enabled, listing]);

    const chosen = choice?.scopeKey === scopeKey && resolved.usable.includes(choice.database) ? choice.database : "";
    const database = chosen || resolved.fallback;
    const status: DatabaseSelectionStatus = !enabled
        ? "off"
        : listing.status === "loading"
            ? "loading"
            : database
                ? "ready"
                : listing.status === "failed" ? "listing-failed" : "empty";

    const select = useCallback((next: string) => {
        if (resolved.usable.includes(next)) setChoice({ scopeKey, database: next });
    }, [resolved.usable, scopeKey]);
    const retry = useCallback(() => {
        setListing({ status: "loading" });
        setAttempt(previous => previous + 1);
    }, []);

    return {
        status,
        database: status === "ready" ? database : "",
        options: resolved.options,
        error: listing.status === "failed" ? listing.error : "",
        select,
        retry,
    };
}

function parseListing(response: ApiResponse): RegisteredDatabase[] {
    const ids = new Set<string>();
    let defaults = 0;
    return response.data.map(row => {
        if (typeof row.id !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(row.id)
            || ids.has(row.id)
            || typeof row.name !== "string" || row.name.trim() === ""
            || typeof row.default !== "boolean"
            || typeof row.enabled !== "boolean"
            || typeof row.available !== "boolean") {
            throw new Error("The database list response was invalid.");
        }
        ids.add(row.id);
        if (row.default) defaults++;
        if (defaults > 1) throw new Error("The database list response was invalid.");
        return {
            id: row.id,
            name: row.name,
            default: row.default,
            enabled: row.enabled,
            available: row.available,
        };
    });
}

function initialListing(): Listing {
    const cached = getCachedResponse(LISTING_CACHE_KEY);
    if (!cached) return { status: "loading" };
    try {
        return { status: "loaded", databases: parseListing(cached) };
    } catch {
        return { status: "loading" };
    }
}
