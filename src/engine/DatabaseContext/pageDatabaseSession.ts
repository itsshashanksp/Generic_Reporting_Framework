const SESSION_MARKER_KEY = "generic-report-page-database-session";
const SELECTION_PREFIX = "generic-report-page-database:";
const DATABASE_ID = /^[a-z][a-z0-9_-]{0,63}$/;

function createMarker() {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ensurePageDatabaseSession() {
    try {
        const existing = sessionStorage.getItem(SESSION_MARKER_KEY);
        if (existing) return existing;
        const marker = createMarker();
        sessionStorage.setItem(SESSION_MARKER_KEY, marker);
        return marker;
    } catch {
        return "";
    }
}

export function beginPageDatabaseSession() {
    clearPageDatabaseSession();
    return ensurePageDatabaseSession();
}

export function clearPageDatabaseSession() {
    try {
        Object.keys(sessionStorage)
            .filter(key => key.startsWith(SELECTION_PREFIX))
            .forEach(key => sessionStorage.removeItem(key));
        sessionStorage.removeItem(SESSION_MARKER_KEY);
    } catch {
        // Storage can be unavailable in hardened browser contexts.
    }
}

function selectionKey(scopeKey: string) {
    const marker = ensurePageDatabaseSession();
    return marker ? `${SELECTION_PREFIX}${marker}:${encodeURIComponent(scopeKey)}` : "";
}

export function readPageDatabaseSelection(scopeKey: string) {
    try {
        const key = selectionKey(scopeKey);
        const value = key ? sessionStorage.getItem(key) : null;
        return value && DATABASE_ID.test(value) ? value : "";
    } catch {
        return "";
    }
}

export function savePageDatabaseSelection(scopeKey: string, database: string) {
    try {
        const key = selectionKey(scopeKey);
        if (!key || !DATABASE_ID.test(database)) return false;
        sessionStorage.setItem(key, database);
        return true;
    } catch {
        return false;
    }
}

export function removePageDatabaseSelection(scopeKey: string) {
    try {
        const key = selectionKey(scopeKey);
        if (key) sessionStorage.removeItem(key);
    } catch {
        // Storage can be unavailable in hardened browser contexts.
    }
}
