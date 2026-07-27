export interface ReportDefinition {

    id: string;

    title: string;

    description?: string;

    icon?: string;

    toolbar: {

        search: boolean;

        export: boolean;

        refresh: boolean;

        settings: boolean;

    };

    grid: {

        pagination: boolean;

        pageSize: number;

        rowSelection: "single" | "multiple";

    };

    filters: any[];

    request: any;

}