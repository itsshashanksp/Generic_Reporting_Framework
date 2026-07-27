import type { ReportDefinition } from "../../types/report";

export function validateReport(
    report: ReportDefinition
): boolean {

    return !!(

        report.id &&
        report.title &&
        report.request

    );

}