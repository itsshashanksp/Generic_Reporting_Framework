import type { ColumnDefinition } from "./column";
import type { FilterDefinition } from "./filter";
import type { GroupingConfig } from "./grouping";
import type { ExportConfig } from "./export";
import type { QuerySort, UniversalQueryRequest } from "./api";
export interface SortDefinition {
    field: string;
    direction: "ASC" | "DESC";
}

export interface PaginationConfig {
    enabled: boolean;
    pageSize: number;
    pageSizeOptions?: number[];
}

export interface ReportRequest extends Omit<UniversalQueryRequest, "sort"> {
    sort?: QuerySort[];
}

export interface ToolbarConfig {
    export: boolean;
    refresh: boolean;
    settings: boolean;
    saveReport?: boolean;
}

export interface GridConfig {
    pagination: PaginationConfig;

    rowSelection: "single" | "multiple";

    grouping?: GroupingConfig;
}

export interface ReportDefinition {
    id: string;

    title: string;

    description?: string;

    toolbar: ToolbarConfig;

    grid: GridConfig;

    export?: ExportConfig;

    columns: ColumnDefinition[];

    filters: FilterDefinition[];

    request: ReportRequest;
}
