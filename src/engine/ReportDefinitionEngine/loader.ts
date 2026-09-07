import { loadColumns } from "../ColumnEngine";
import { loadFilters } from "../FilterEngine";
import type {
    ReportConfiguration,
    ReportDefinition,
    ReportRequest,
} from "../../types/report";
import { defaultReportDefinition } from "./defaults";
import { getReportValidationErrors } from "./validator";

export type ResolvedReportQuery =
    | {
          kind: "legacy";
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
        return { kind: "legacy", request: report.request };
    }

    return {
        kind: "sql",
        request: {
            action: "sql",
            resource: report.queryDefinition.resource,
        },
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
    } as ReportDefinition;
}
