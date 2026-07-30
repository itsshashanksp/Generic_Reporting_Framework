import type { ColumnDefinition } from "./column";
import type { FilterDefinition } from "./filter";
export interface SortDefinition {
    column: string;
    direction: "ASC" | "DESC";
}

export interface ReportRequest {
    controller: string;
    action: string;
    table: string;

    columns?: string[];

    where?: any[];

    sort?: SortDefinition[];

    filters?: Record<string, any>;
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