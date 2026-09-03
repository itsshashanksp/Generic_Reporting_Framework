import type { SavedReport } from "../../types/savedReport";

const STORAGE_KEY = "generic-report-saved-reports";

export function loadSavedReports(): SavedReport[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

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
    report: SavedReport
): void {

    const reports = loadSavedReports();

    const existingIndex = reports.findIndex(
        item => item.id === report.id
    );

    if (existingIndex >= 0) {

        reports[existingIndex] = report;

    } else {

        reports.push(report);

    }

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(reports)
    );
}

export function deleteSavedReport(
    id: string
): void {

    const reports = loadSavedReports();

    const updatedReports = reports.filter(
        report => report.id !== id
    );

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedReports)
    );
}
