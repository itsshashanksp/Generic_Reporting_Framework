import { defaultReportDefinition } from "./defaults";
import { loadColumns } from "../ColumnEngine";
import { loadFilters } from "../FilterEngine";
import type { ReportDefinition } from "../../types/report";
import { getReportValidationErrors } from "./validator";

export function loadDefinition(
    value: unknown
): ReportDefinition {

    const errors = getReportValidationErrors(value);
    if (errors.length > 0) {
        throw new Error(`Invalid report configuration: ${errors.join(" ")}`);
    }

    const report = value as ReportDefinition;

    return {

        ...defaultReportDefinition,

        ...report,

        toolbar: {
            ...defaultReportDefinition.toolbar,
            ...report.toolbar,
        },

        grid: {
            ...defaultReportDefinition.grid,
            ...report.grid,
            pagination: {
                ...defaultReportDefinition.grid?.pagination,
                ...report.grid?.pagination,
            },
        },

        columns: loadColumns(report.columns || []),

        filters: loadFilters(report.filters || [])

    } as ReportDefinition;

}
