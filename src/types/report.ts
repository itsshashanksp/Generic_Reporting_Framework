import type { ColumnDefinition } from "./column";
import type { FilterDefinition } from "./filter";

export interface ReportRequest {
    controller: string;
    action: string;
    table: string;
    where?: string;
    orderBy?: string;
}

export interface ToolbarConfig {
    search: boolean;
    export: boolean;
    refresh: boolean;
    settings: boolean;
}

export interface GridConfig {
    pagination: boolean;
    pageSize: number;
    rowSelection: "single" | "multiple";
}

export interface ReportFilter {
    id: string;
    label: string;
    type:
        | "text"
        | "number"
        | "date"
        | "daterange"
        | "select"
        | "multiselect"
        | "checkbox";

    field: string;

    defaultValue?: unknown;

    options?: {
        label: string;
        value: string | number;
    }[];
}

export interface ReportDefinition {

    id: string;

    title: string;

    description?: string;

    icon?: string;

    toolbar: ToolbarConfig;

    grid: GridConfig;

    columns: ColumnDefinition[];

    filters: FilterDefinition[];

    request: ReportRequest;
}