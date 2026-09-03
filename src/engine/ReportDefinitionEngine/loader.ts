import { defaultReportDefinition } from "./defaults";
import { loadColumns } from "../ColumnEngine";
import { loadFilters } from "../FilterEngine";
import type { ReportDefinition } from "../../types/report";

export function loadDefinition(
    report: ReportDefinition
): ReportDefinition {

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
