import { useCallback, useEffect, useMemo, useState } from "react";

import { executeRequest, getRequestErrorMessage, isRequestAbort } from "../../api/request";
import {
    createRequestCacheKey,
    getCachedResponse,
    getOrCreateInFlightRequest,
    setCachedResponse,
} from "../RequestCache";
import type { ApiResponse } from "../../types/api";

export interface DatabaseOption {
    id: string;
    label: string;
    disabled: boolean;
}

interface RegisteredDatabase {
    id: string;
    name: string;
    default: boolean;
    enabled: boolean;
    available: boolean;
}

export type DatabaseRegistryStatus = "loading" | "ready" | "failed" | "empty";

const LISTING_REQUEST = { action: "metadata.databases" } as const;
const LISTING_CACHE_KEY = createRequestCacheKey("metadata-databases", LISTING_REQUEST);

type Listing =
    | { status: "loading" }
    | { status: "loaded"; databases: RegisteredDatabase[] }
    | { status: "failed"; error: string };
const LOADING_LISTING: Listing = { status: "loading" };

export function useDatabaseRegistry(enabled = true, scopeKey = "shared") {
    const [listingState, setListingState] = useState<{ scopeKey: string; listing: Listing }>(() => ({
        scopeKey,
        listing: initialListing(),
    }));
    const [attempt, setAttempt] = useState(0);
    const listing = listingState.scopeKey === scopeKey ? listingState.listing : LOADING_LISTING;

    useEffect(() => {
        if (!enabled || listing.status !== "loading") return;
        const controller = new AbortController();
        void getOrCreateInFlightRequest(
            LISTING_CACHE_KEY,
            signal => executeRequest(LISTING_REQUEST, { signal }),
            controller.signal
        ).then(response => {
            const databases = parseDatabaseListing(response);
            setCachedResponse(LISTING_CACHE_KEY, response);
            setListingState({ scopeKey, listing: { status: "loaded", databases } });
        }).catch((error: unknown) => {
            if (!isRequestAbort(error)) {
                setListingState({ scopeKey, listing: { status: "failed", error: getRequestErrorMessage(error, "The database list could not be loaded.") } });
            }
        });
        return () => controller.abort();
    }, [enabled, listing.status, attempt, scopeKey]);

    const resolved = useMemo(() => {
        if (!enabled || listing.status !== "loaded") {
            return { options: [] as DatabaseOption[], usable: [] as string[], fallback: "" };
        }
        const registered = listing.databases.filter(database => database.enabled);
        const usable = registered.filter(database => database.available).map(database => database.id);
        const backendDefault = listing.databases.find(database => database.default)?.id;
        return {
            options: registered.map(database => ({
                id: database.id,
                label: database.available ? database.name || database.id : `${database.name || database.id} (unavailable)`,
                disabled: !database.available,
            })),
            usable,
            fallback: backendDefault && usable.includes(backendDefault) ? backendDefault : usable[0] ?? "",
        };
    }, [enabled, listing]);

    const retry = useCallback(() => {
        setListingState({ scopeKey, listing: { status: "loading" } });
        setAttempt(previous => previous + 1);
    }, [scopeKey]);

    const status: DatabaseRegistryStatus = !enabled || listing.status === "loading"
        ? "loading"
        : listing.status === "failed"
            ? "failed"
            : resolved.usable.length > 0 ? "ready" : "empty";

    return {
        status,
        options: resolved.options,
        usable: resolved.usable,
        fallback: resolved.fallback,
        error: listing.status === "failed" ? listing.error : "",
        retry,
    };
}

export function parseDatabaseListing(response: ApiResponse): RegisteredDatabase[] {
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
        return { status: "loaded", databases: parseDatabaseListing(cached) };
    } catch {
        return { status: "loading" };
    }
}
