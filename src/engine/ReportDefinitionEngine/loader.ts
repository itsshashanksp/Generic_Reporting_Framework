import { defaultReportDefinition } from "./defaults";
import { loadColumns } from "../ColumnEngine";
import { loadFilters } from "../FilterEngine";

export function loadDefinition(report: any) {

    return {

        ...defaultReportDefinition,

        ...report,

        columns: loadColumns(report.columns || []),

        filters: loadFilters(report.filters || [])

    };

}