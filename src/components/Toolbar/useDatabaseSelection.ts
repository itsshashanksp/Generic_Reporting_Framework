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
    /** The listing failed; the user must choose explicitly before anything is requested. */
    | "listing-failed"
    /** No permitted database is registered, enabled and available. */
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
 * 1. Options: the permitted ids the registry lists as enabled, in configured
 *    order; unavailable ones are shown but cannot be chosen.
 * 2. Initial selection: the registry default when it is permitted and
 *    available; otherwise the first permitted, available id in configured
 *    order; otherwise none ("empty").
 * 3. If the listing fails, nothing is chosen automatically: the permitted ids
 *    are offered unverified and nothing is requested until the user picks one.
 *
 * `scopeKey` (the report or dashboard id) resets the user's choice.
 */
export function useDatabaseSelection(scopeKey: string, permitted: string[] | undefined): DatabaseSelection {
    const enabled = Boolean(permitted?.length);
    const [listing, setListing] = useState<Listing>(() => {
        const cached = getCachedResponse(LISTING_CACHE_KEY);
        return cached ? { status: "loaded", databases: parseListing(cached) } : { status: "loading" };
    });
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
            setCachedResponse(LISTING_CACHE_KEY, response);
            setListing({ status: "loaded", databases: parseListing(response) });
        }).catch((error: unknown) => {
            if (!isRequestAbort(error)) {
                setListing({ status: "failed", error: getRequestErrorMessage(error, "The database list could not be loaded.") });
            }
        });
        return () => controller.abort();
    }, [enabled, listing.status, attempt]);

    const resolved = useMemo(() => {
        if (!enabled || !permitted) return { options: [] as DatabaseOption[], usable: [] as string[], fallback: "" };
        if (listing.status === "failed") {
            return { options: permitted.map(id => ({ id, label: id, disabled: false })), usable: permitted, fallback: "" };
        }
        if (listing.status !== "loaded") return { options: [], usable: [], fallback: "" };
        const registry = new Map(listing.databases.map(database => [database.id, database]));
        const registered = permitted.flatMap(id => {
            const entry = registry.get(id);
            return entry?.enabled ? [entry] : [];
        });
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
    }, [enabled, listing, permitted]);

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
    return response.data.flatMap(row => typeof row.id === "string"
        && typeof row.enabled === "boolean"
        && typeof row.available === "boolean"
        ? [{
            id: row.id,
            name: typeof row.name === "string" ? row.name : row.id,
            default: row.default === true,
            enabled: row.enabled,
            available: row.available,
        }]
        : []);
}
