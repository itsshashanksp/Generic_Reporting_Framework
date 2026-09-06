import type { ReportConfiguration, ReportDefinition } from "../../types/report";
import { getReportValidationErrors } from "../ReportDefinitionEngine/validator";
import { loadDefinition } from "../ReportDefinitionEngine/loader";

const reportFiles = import.meta.glob(
    "../../config/reports/*.json",
    {
        eager: true,
        import: "default",
    }
) as Record<string, ReportConfiguration>;

const reportErrors: Record<string, string> = {};
const reports = buildReportRegistry(reportFiles, reportErrors);

export function buildReportRegistry(
    modules: Record<string, unknown>,
    loadErrors: Record<string, string> = {}
): Record<string, ReportDefinition> {
    const registry: Record<string, ReportDefinition> = {};

    Object.entries(modules).forEach(([source, report]) => {
        const validationErrors = getReportValidationErrors(report);
        if (validationErrors.length > 0) {
            console.error(`Invalid report configuration: ${source}`, validationErrors);
            recordReportError(report, validationErrors.join(" "), loadErrors);
            return;
        }

        try {
            const loaded = loadDefinition(report);
            if (Object.prototype.hasOwnProperty.call(registry, loaded.id)) {
                console.error(`Duplicate report id "${loaded.id}" in ${source}.`);
                return;
            }
            registry[loaded.id] = loaded;
        } catch (error) {
            console.error(`Unable to load report configuration: ${source}`, error);
            recordReportError(
                report,
                error instanceof Error ? error.message : "Unable to load report configuration.",
                loadErrors
            );
        }
    });

    return registry;
}


export function getReport(
    reportId: string
): ReportDefinition | undefined {

    return reports[reportId];

}

export function getReportIds(): string[] {
    return Object.keys(reports);
}

export function getReportError(reportId: string): string | undefined {
    return reportErrors[reportId];
}

function recordReportError(
    report: unknown,
    message: string,
    target: Record<string, string>
): void {
    if (
        typeof report === "object"
        && report !== null
        && "id" in report
        && typeof report.id === "string"
        && report.id.trim().length > 0
    ) {
        target[report.id] = message;
    }
}
