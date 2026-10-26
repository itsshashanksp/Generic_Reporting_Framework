import { useCallback, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "../../auth";
import { useDatabaseRegistry } from "./databaseRegistry";
import { GlobalDatabaseContext } from "./context";

const STORAGE_PREFIX = "generic-report-global-database:user:";
const DATABASE_ID = /^[a-z][a-z0-9_-]{0,63}$/;

interface StoredSelection {
    owner: string;
    database: string;
}

export function GlobalDatabaseProvider({ children }: { children: ReactNode }) {
    const { state } = useAuth();
    const owner = state.status === "authenticated" ? state.user.username : "";
    const registry = useDatabaseRegistry(Boolean(owner), owner || "signed-out");
    const [stored, setStored] = useState<StoredSelection | null>(null);
    const restored = stored?.owner === owner ? stored : { owner, database: readStoredDatabase(owner) };
    const configuredDatabase = restored.database;
    const database = registry.status === "ready" && registry.usable.includes(configuredDatabase)
        ? configuredDatabase
        : "";
    const resolving = Boolean(owner && configuredDatabase && registry.status === "loading");

    const save = useCallback((next: string) => {
        if (!owner || next && !registry.usable.includes(next)) return false;
        try {
            if (next) localStorage.setItem(storageKey(owner), next);
            else localStorage.removeItem(storageKey(owner));
        } catch {
            return false;
        }
        setStored({ owner, database: next });
        return true;
    }, [owner, registry.usable]);

    const value = useMemo(() => ({ database, configuredDatabase, resolving, registry, save }),
        [database, configuredDatabase, resolving, registry, save]);
    return <GlobalDatabaseContext.Provider value={value}>{children}</GlobalDatabaseContext.Provider>;
}

function storageKey(owner: string) {
    return `${STORAGE_PREFIX}${encodeURIComponent(owner)}`;
}

function readStoredDatabase(owner: string) {
    if (!owner) return "";
    try {
        const candidate = localStorage.getItem(storageKey(owner));
        return candidate && DATABASE_ID.test(candidate) ? candidate : "";
    } catch {
        return "";
    }
}
