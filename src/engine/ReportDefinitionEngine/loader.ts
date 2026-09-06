import { loadColumns } from "../ColumnEngine";
import { loadFilters } from "../FilterEngine";
import {
    getSqlDefinition,
    parseReportSql,
    toUniversalQueryRequest,
    type QueryDefinition,
} from "../ReportQueryEngine";
import type {
    ReportConfiguration,
    ReportDefinition,
    ReportRequest,
} from "../../types/report";
import { defaultReportDefinition } from "./defaults";
import { getReportValidationErrors } from "./validator";

export type ReportQueryResolutionErrorCode =
    | "MISSING_SQL_RESOURCE"
    | "INVALID_SQL_RESOURCE";

export class ReportQueryResolutionError extends Error {
    readonly code: ReportQueryResolutionErrorCode;

    constructor(code: ReportQueryResolutionErrorCode, message: string) {
        super(message);
        this.name = "ReportQueryResolutionError";
        this.code = code;
    }
}

export type ResolvedReportQuery =
    | {
          kind: "legacy";
          request: ReportRequest;
      }
    | {
          kind: "sql";
          definition: QueryDefinition;
          request: ReportRequest;
      };

export interface LoadDefinitionOptions {
    resolveSql?: (resource: string) => string | undefined;
    columnsRequired?: boolean;
}

export function resolveReportQuery(
    report: ReportConfiguration,
    resolveSql: (resource: string) => string | undefined = getSqlDefinition
): ResolvedReportQuery {
    if (report.queryDefinition === undefined) {
        return { kind: "legacy", request: report.request };
    }

    const { resource } = report.queryDefinition;
    const sql = resolveSql(resource);
    if (sql === undefined) {
        throw new ReportQueryResolutionError(
            "MISSING_SQL_RESOURCE",
            `SQL resource "${resource}" was not found for report "${report.id}".`
        );
    }

    try {
        const definition = parseReportSql(sql);
        return {
            kind: "sql",
            definition,
            request: toUniversalQueryRequest(definition),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown SQL parser error.";
        throw new ReportQueryResolutionError(
            "INVALID_SQL_RESOURCE",
            `SQL resource "${resource}" for report "${report.id}" is invalid: ${message}`
        );
    }
}

export function loadDefinition(
    value: unknown,
    {
        resolveSql = getSqlDefinition,
        columnsRequired = true,
    }: LoadDefinitionOptions = {}
): ReportDefinition {
    const errors = getReportValidationErrors(value, { columnsRequired });
    if (errors.length > 0) {
        throw new Error(`Invalid report configuration: ${errors.join(" ")}`);
    }

    const report = value as ReportConfiguration;
    const resolvedQuery = resolveReportQuery(report, resolveSql);

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
    } as ReportDefinition;
}
