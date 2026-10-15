import type { SavedReport } from "../../types/savedReport";

/**
 * Saved views hold report filters, sorting and paging (never row data) and
 * are kept per signed-in username so users sharing a browser cannot see each
 * other's views. Browser storage is a convenience, not a security boundary:
 * the backend still authorizes every data request.
 */
const STORAGE_KEY_PREFIX = "generic-report-saved-reports:user:";
/** Pre-scoping key shared by every user; its owner cannot be determined. */
const UNSCOPED_STORAGE_KEY = "generic-report-saved-reports";

function storageKey(owner: string) {
    return `${STORAGE_KEY_PREFIX}${encodeURIComponent(owner)}`;
}

export function loadSavedReports(owner: string): SavedReport[] {
    try {
        const stored = localStorage.getItem(storageKey(owner));

        if (!stored) {
            return [];
        }

        const parsed: unknown = JSON.parse(stored);

        return Array.isArray(parsed)
            ? parsed.filter(isSavedReport)
            : [];

    } catch {

        return [];

    }
}

function isSavedReport(value: unknown): value is SavedReport {
    return typeof value === "object"
        && value !== null
        && "id" in value
        && typeof value.id === "string"
        && "reportId" in value
        && typeof value.reportId === "string"
        && "name" in value
        && typeof value.name === "string"
        && "createdAt" in value
        && typeof value.createdAt === "string"
        && "updatedAt" in value
        && typeof value.updatedAt === "string"
        && "state" in value
        && typeof value.state === "object"
        && value.state !== null
        && "filters" in value.state
        && typeof value.state.filters === "object"
        && value.state.filters !== null
        && "sorting" in value.state
        && Array.isArray(value.state.sorting)
        && "pagination" in value.state
        && typeof value.state.pagination === "object"
        && value.state.pagination !== null;
}

export function saveSavedReport(
    owner: string,
    report: SavedReport
): void {

    const reports = loadSavedReports(owner);

    const existingIndex = reports.findIndex(
        item => item.id === report.id
    );

    if (existingIndex >= 0) {

        reports[existingIndex] = report;

    } else {

        reports.push(report);

    }

    localStorage.setItem(
        storageKey(owner),
        JSON.stringify(reports)
    );
}

export function deleteSavedReport(
    owner: string,
    id: string
): void {

    const reports = loadSavedReports(owner);

    const updatedReports = reports.filter(
        report => report.id !== id
    );

    localStorage.setItem(
        storageKey(owner),
        JSON.stringify(updatedReports)
    );
}

/** Removes views saved before per-user scoping; they cannot be attributed to a user. */
export function removeUnscopedSavedReports(): void {
    try {
        localStorage.removeItem(UNSCOPED_STORAGE_KEY);
    } catch {
        // Storage may be unavailable (private mode or blocked site data).
    }
}
