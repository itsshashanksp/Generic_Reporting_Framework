import type { ColumnDefinition } from "./column";
import type { FilterDefinition } from "./filter";
import type { GroupingConfig } from "./grouping";
import type { ExportConfig } from "./export";
import type { DataRequest, QuerySort } from "./api";
export interface SortDefinition {
    field: string;
    direction: "ASC" | "DESC";
}

export interface PaginationConfig {
    enabled: boolean;
    pageSize: number;
    pageSizeOptions?: number[];
}

export type ReportRequest = DataRequest & { sort?: QuerySort[] };

/** Backend-owned SQL resource metadata. No SQL text is loaded by the frontend. */
export interface ReportQueryDefinitionReference {
    format: "sql";
    resource: string;
    /** Logical V3 database id sent with the SQL Resource request. */
    database?: string;
}

export interface ToolbarConfig {
    export: boolean;
    refresh: boolean;
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

    /** Initial sorting and filter composition shared by both query modes. */
    sort?: SortDefinition[];

    filterLogic?: "AND" | "OR";

    /**
     * Lets users rerun the report against another logical database. The
     * listed ids must all hold the report's tables or SQL Resource. The
     * backend registry default (or the first available listed id) is the
     * initial selection; `request.database`, if set, must be listed.
     */
    databaseSelection?: {
        databases: string[];
    };
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

/** Normalized definition consumed by the shared report runtime. */
export interface ReportDefinition extends ReportPresentationDefinition {
    queryDefinition?: ReportQueryDefinitionReference;

    request: ReportRequest;
}
