import type { ReportDefinition } from "../../types/report";

export const defaultReportDefinition: Partial<ReportDefinition> = {

    toolbar: {

        search: true,

        export: true,

        refresh: true,

        settings: true,

    },

    grid: {

        pagination: true,

        pageSize: 50,

        rowSelection: "multiple",

    },

    filters: [],

};