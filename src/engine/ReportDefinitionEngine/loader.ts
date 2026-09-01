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

        columns: loadColumns(report.columns || []),

        filters: loadFilters(report.filters || [])

    } as ReportDefinition;

}
