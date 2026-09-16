import { loadColumns } from "../ColumnEngine";
import { loadFilters } from "../FilterEngine";
import type {
    ReportConfiguration,
    ReportDefinition,
    ReportRequest,
} from "../../types/report";
import type { SqlExecutionMetadata, SqlResourceRequest } from "../../types/api";
import { defaultReportDefinition } from "./defaults";
import { getReportValidationErrors } from "./validator";

export type ResolvedReportQuery =
    | {
          kind: "json";
          request: ReportRequest;
      }
    | {
          kind: "sql";
          request: ReportRequest;
      };

export interface LoadDefinitionOptions {
    columnsRequired?: boolean;
}

export function resolveReportQuery(
    report: ReportConfiguration
): ResolvedReportQuery {
    if (report.queryDefinition === undefined) {
        return {
            kind: "json",
            request: {
                ...report.request,
                ...(report.sort?.length ? { sort: report.sort } : {}),
                ...(report.filterLogic ? { filterLogic: report.filterLogic } : {}),
            },
        };
    }

    return {
        kind: "sql",
        request: buildSqlResourceRequest(report),
    };
}

/** Translates normalized presentation configuration into the SQL API envelope. */
export function buildSqlResourceRequest(
    report: Pick<ReportConfiguration, "queryDefinition" | "columns" | "filters" | "sort" | "filterLogic">
): SqlResourceRequest {
    if (!report.queryDefinition) {
        throw new Error("SQL queryDefinition is required.");
    }

    const columns = [...new Set((report.columns ?? []).map(column => column.field))];
    const outputColumns = new Set(columns.map(field => field.toLowerCase()));
    const sourceFilters = Object.fromEntries(
        (report.filters ?? [])
            .filter(filter => !outputColumns.has(filter.field.toLowerCase()))
            .map(filter => [filter.field, toSourceFilter()])
    );
    const execution: SqlExecutionMetadata = {
        ...(columns.length > 0 ? { columns } : {}),
        ...(Object.keys(sourceFilters).length > 0 ? { filters: sourceFilters } : {}),
    };

    return {
        action: "sql",
        resource: report.queryDefinition.resource,
        ...(Object.keys(execution).length > 0 ? { execution } : {}),
        ...(report.sort?.length ? { sort: report.sort } : {}),
        ...(report.filterLogic ? { filterLogic: report.filterLogic } : {}),
    };
}

function toSourceFilter() {
    return {
        placement: "source" as const,
    };
}

export function loadDefinition(
    value: unknown,
    {
        columnsRequired = true,
    }: LoadDefinitionOptions = {}
): ReportDefinition {
    const errors = getReportValidationErrors(value, { columnsRequired });
    if (errors.length > 0) {
        throw new Error(`Invalid report configuration: ${errors.join(" ")}`);
    }

    const report = value as ReportConfiguration;
    const resolvedQuery = resolveReportQuery(report);

    return {
        ...defaultReportDefinition,
        ...report,
        request: resolvedQuery.request,
        toolbar: {
            ...defaultReportDefinition.toolbar,
            ...report.toolbar,
        },
        grid: {
            ...defaultReportDefinition.grid,
            ...report.grid,
            pagination: {
                ...defaultReportDefinition.grid?.pagination,
                ...report.grid?.pagination,
            },
        },
        columns: loadColumns(report.columns || []),
        filters: loadFilters(report.filters || []),
        sort: report.sort ?? [],
    } as ReportDefinition;
}
