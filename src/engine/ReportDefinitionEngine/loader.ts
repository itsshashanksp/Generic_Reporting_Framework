import { defaultReportDefinition } from "./defaults";

export function loadDefinition(report: any) {

    return {

        ...defaultReportDefinition,

        ...report,

    };

}