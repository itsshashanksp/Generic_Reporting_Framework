import type { SavedReport } from "../../types/savedReport";

const STORAGE_KEY = "generic-report-saved-reports";

export function loadSavedReports(): SavedReport[] {

    const stored = localStorage.getItem(
        STORAGE_KEY
    );

    if (!stored) {
        return [];
    }

    try {

        return JSON.parse(stored);

    } catch {

        return [];

    }
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