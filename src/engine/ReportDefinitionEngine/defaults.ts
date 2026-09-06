import type { ReportDefinition } from "../../types/report";

export const defaultReportDefinition: Partial<ReportDefinition> = {

    toolbar: {

        export: true,

        refresh: true,

        settings: true,

        saveReport: true,

    },

grid: {
    pagination: {
        enabled: true,
        pageSize: 50,
        pageSizeOptions: [25, 50, 100],
    },

    rowSelection: "single",
},

    filters: [],

};
