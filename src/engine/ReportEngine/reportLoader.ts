import type { ReportDefinition } from "../../types/report";

const reportFiles = import.meta.glob(
    "../../config/reports/*.json",
    {
        eager: true,
        import: "default",
    }
) as Record<string, ReportDefinition>;


const reports: Record<
    string,
    ReportDefinition
> = {};


for (const report of Object.values(
    reportFiles
)) {

    if (
        report &&
        typeof report.id === "string" &&
        report.id.trim() !== ""
    ) {

        reports[report.id] = report;

    }

}


export function getReport(
    reportId: string
): ReportDefinition | undefined {

    return reports[reportId];

}