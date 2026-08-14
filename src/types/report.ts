import type { ColumnDefinition } from "./column";
import type { FilterDefinition } from "./filter";
import type { GroupingConfig } from "./grouping";

export interface SortDefinition {
    column: string;
    direction: "ASC" | "DESC";
}

export interface PaginationConfig {
    enabled: boolean;
    pageSize: number;
    pageSizeOptions?: number[];
}

export interface ReportPagination {
    page: number;
    pageSize: number;
}

export interface ReportRequest {
    controller: string;
    action: string;
    table: string;

    columns?: (
        | string
        | {
              function: string;
              column: string;
              alias?: string;
          }
    )[];

    groupBy?: string[];

    where?: any[];

    sort?: SortDefinition[];

    page?: number;

    pageSize?: number;

    filters?: Record<string, any>;
}

export interface ToolbarConfig {
    search: boolean;
    export: boolean;
    refresh: boolean;
    settings: boolean;
}

export interface GridConfig {
    pagination: PaginationConfig;

    rowSelection: "single" | "multiple";

    grouping?: GroupingConfig;
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