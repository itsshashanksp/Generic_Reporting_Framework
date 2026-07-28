import { defaultReportDefinition } from "./defaults";
import { loadColumns } from "../ColumnEngine";

export function loadDefinition(report: any) {

    return {

        ...defaultReportDefinition,

        ...report,

        columns: loadColumns(report.columns || [])

    };

}