import type { ReportDefinition } from "../../types/report";
import { getReportValidationErrors } from "../ReportDefinitionEngine/validator";
import { loadDefinition } from "../ReportDefinitionEngine/loader";

const reportFiles = import.meta.glob(
    "../../config/reports/*.json",
    {
        eager: true,
        import: "default",
    }
) as Record<string, ReportDefinition>;


const reports = buildReportRegistry(reportFiles);

export function buildReportRegistry(
    modules: Record<string, unknown>
): Record<string, ReportDefinition> {
    const registry: Record<string, ReportDefinition> = {};

    Object.entries(modules).forEach(([source, report]) => {
        const errors = getReportValidationErrors(report);
        if (errors.length > 0) {
            console.error(`Invalid report configuration: ${source}`, errors);
            return;
        }

        try {
            const loaded = loadDefinition(report as ReportDefinition);
            if (Object.prototype.hasOwnProperty.call(registry, loaded.id)) {
                console.error(`Duplicate report id "${loaded.id}" in ${source}.`);
                return;
            }
            registry[loaded.id] = loaded;
        } catch (error) {
            console.error(`Unable to load report configuration: ${source}`, error);
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
