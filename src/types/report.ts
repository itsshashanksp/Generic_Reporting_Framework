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

/** Static SQL authoring metadata. The referenced resource is authoritative. */
export interface ReportQueryDefinitionReference {
    format: "sql";
    resource: string;
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

export interface ReportPresentationDefinition {
    id: string;

    title: string;

    description?: string;

    toolbar: ToolbarConfig;

    grid: GridConfig;

    export?: ExportConfig;

    columns: ColumnDefinition[];

    filters: FilterDefinition[];
}

export type ReportConfiguration = ReportPresentationDefinition & (
    | {
          request: ReportRequest;
          queryDefinition?: never;
      }
    | {
          request?: never;
          queryDefinition: ReportQueryDefinitionReference;
      }
);

/** Normalized definition consumed by the existing report runtime. */
export interface ReportDefinition extends ReportPresentationDefinition {
    queryDefinition?: ReportQueryDefinitionReference;

    request: ReportRequest;
}
