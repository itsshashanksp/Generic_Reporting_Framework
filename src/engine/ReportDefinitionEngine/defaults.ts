import type { ReportDefinition } from "../../types/report";

export const defaultReportDefinition: Partial<ReportDefinition> = {

    toolbar: {

        export: true,

        refresh: true,

        saveReport: true,

    },

grid: {
    pagination: {
        enabled: true,
        pageSize: 10,
        pageSizeOptions: [10, 25, 50, 100],
    },

    rowSelection: "single",
},

    filters: [],

};
