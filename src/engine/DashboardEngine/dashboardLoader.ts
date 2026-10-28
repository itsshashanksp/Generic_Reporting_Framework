import type { DashboardDefinition } from "../../types/dashboard";

import {
    validateDashboard,
} from "../DashboardValidator";
import type {
    DashboardValidationResult,
} from "../DashboardValidator";
import { loadFilters } from "../FilterEngine";
import { getReport, getReportIds } from "../ReportEngine/reportLoader";
import type { DashboardWidget, WidgetRequest } from "../../types/widget";
import type { ColumnDefinition } from "../../types/column";
import type { ReportConfiguration, ReportDefinition } from "../../types/report";
import { loadDefinition } from "../ReportDefinitionEngine";
import { buildSqlResourceRequest } from "../ReportDefinitionEngine/loader";
import type { FilterDefinition } from "../../types/filter";
import {
    getWidgetDefinition,
    getWidgetDefinitionIds,
} from "../WidgetEngine";
import { mapWidgetFilters } from "./filterFields";
import { applyDateFilterBehavior } from "./dateFilterBehavior";

export type DashboardLoadResult =
    | {
          status: "valid";
          dashboard: DashboardDefinition;
          validation: DashboardValidationResult;
      }
    | {
          status: "invalid";
          dashboard: unknown;
          validation: DashboardValidationResult;
      }
    | {
          status: "not-found";
          dashboard: null;
          validation: null;
      };

const dashboardModules = import.meta.glob(
    "@runtime-config/dashboards/*.json",
    { eager: true, import: "default" }
) as Record<string, unknown>;

const dashboards = buildDashboardRegistry(dashboardModules);

export function getDashboard(
    dashboardId: string
): DashboardLoadResult {

    if (
        !Object.prototype.hasOwnProperty.call(
            dashboards,
            dashboardId
        )
    ) {
        return {
            status: "not-found",
            dashboard: null,
            validation: null,
        };
    }

    return loadDashboardConfiguration(dashboards[dashboardId], dashboardId);
}

/**
 * Validates one dashboard configuration and normalizes its shared filters,
 * including its `dateFilterBehavior`. `getDashboard` uses it for registered
 * dashboards.
 */
export function loadDashboardConfiguration(
    dashboardConfiguration: unknown,
    dashboardId = "dashboard"
): Exclude<DashboardLoadResult, { status: "not-found" }> {

    const validation =
        validateDashboard(
            dashboardConfiguration,
            {
                reportIds: getReportIds(),
                widgetIds: getWidgetDefinitionIds(),
            }
        );

    if (!validation.valid) {

        console.error(
            `Invalid dashboard configuration: ${dashboardId}`,
            validation.errors
        );

        return {
            status: "invalid",
            dashboard:
                dashboardConfiguration,
            validation,
        };
    }

    // A database selector must control at least one widget: one whose resolved
    // request (inline, reportId or widgetId) names no database of its own.
    const definition = dashboardConfiguration as DashboardDefinition;
    const runtimeFilterWarnings = definition.widgets.flatMap(widget => {
        if (!widget.runtimeFilters?.length) return [];
        const request = resolveDashboardWidgetDefinition(widget, definition.filters ?? [])?.request;
        const authoredFields = new Set(
            (Array.isArray(request?.filters) ? request.filters : [])
                .flatMap(condition => typeof condition === "object" && condition !== null
                    && "field" in condition && typeof condition.field === "string"
                    ? [condition.field.toLowerCase()] : [])
        );
        return widget.runtimeFilters
            .filter(filter => authoredFields.has(filter.field.toLowerCase()))
            .map(filter => `Widget "${widget.id}" runtime filter "${filter.field}" repeats an authored request filter targeting the same field; both conditions are sent.`);
    });
    validation.warnings.push(...runtimeFilterWarnings);
    definition.widgets.forEach(widget => {
        const request = resolveDashboardWidgetDefinition(widget, definition.filters ?? [])?.request;
        if (request?.filterLogic !== "OR") return;
        const sourceCount = [
            Array.isArray(request.filters) && request.filters.length > 0,
            (definition.filters?.length ?? 0) > 0,
            (widget.runtimeFilters?.length ?? 0) > 0,
        ].filter(Boolean).length;
        if (sourceCount > 1) {
            validation.warnings.push(`Widget "${widget.id}" uses flat OR across authored, dashboard, or widget filters; every condition is an alternative, not a mandatory constraint.`);
        }
    });
    validation.warnings = [...new Set(validation.warnings)];
    if (
        validation.warnings.length > 0
    ) {

        console.warn(
            `Dashboard configuration warnings: ${dashboardId}`,
            validation.warnings
        );

    }

    return {
        status: "valid",
        dashboard: {
            ...(dashboardConfiguration as DashboardDefinition),
            filters: applyDateFilterBehavior(
                loadFilters((dashboardConfiguration as DashboardDefinition).filters ?? []),
                (dashboardConfiguration as DashboardDefinition).dateFilterBehavior
            ),
            widgets: (dashboardConfiguration as DashboardDefinition).widgets.map(widget => ({
                ...widget,
                ...(widget.runtimeFilters !== undefined
                    ? { runtimeFilters: loadFilters(widget.runtimeFilters) }
                    : {}),
            })),
        },
        validation,
    };
}

export function buildDashboardRegistry(
    modules: Record<string, unknown>
): Record<string, unknown> {
    const registry: Record<string, unknown> = {};

    Object.values(modules).forEach(dashboard => {
        if (
            typeof dashboard === "object" &&
            dashboard !== null &&
            "id" in dashboard &&
            typeof dashboard.id === "string" &&
            dashboard.id.trim().length > 0
        ) {
            if (Object.prototype.hasOwnProperty.call(registry, dashboard.id)) {
                console.error(`Duplicate dashboard id "${dashboard.id}".`);
                return;
            }
            registry[dashboard.id] = dashboard;
        }
    });

    return registry;
}

export function getDashboardIds(): string[] {
    return Object.keys(dashboards);
}

/**
 * Resolves inline definitions first, then existing report/widget references.
 * Shared filters are renamed by the widget's `filterFields` first, so its SQL
 * Resource declaration names the same field as its runtime filters.
 */
export function resolveDashboardWidgetDefinition(
    widget: DashboardWidget,
    dashboardFilters: FilterDefinition[] = []
): ReportDefinition | undefined {
    const sharedFilters = mapWidgetFilters(dashboardFilters, {}, widget.filterFields).filters;
    const filters = mergeFilterDefinitions(
        mergeFilterDefinitions(widget.filters ?? [], widget.runtimeFilters ?? []),
        sharedFilters
    );
    if (widget.queryDefinition || widget.request) {
        const configuration: ReportConfiguration = {
            id: widget.id,
            title: widget.title,
            ...(widget.description !== undefined
                ? { description: widget.description }
                : {}),
            ...(widget.queryDefinition
                ? { queryDefinition: widget.queryDefinition }
                : { request: widget.request! }),
            ...(widget.columns !== undefined ? { columns: widget.columns } : {}),
            filters,
            ...(widget.sort !== undefined ? { sort: widget.sort } : {}),
            ...(widget.filterLogic !== undefined ? { filterLogic: widget.filterLogic } : {}),
            ...(widget.grid !== undefined ? { grid: widget.grid } : {}),
            ...(widget.toolbar !== undefined ? { toolbar: widget.toolbar } : {}),
            // Chart export is presentation owned and supports PNG/SVG. The
            // internal report definition exists only to normalize its data
            // request, whose export schema is intentionally CSV/Excel-only.
            ...(widget.type !== "chart" && widget.export !== undefined
                ? { export: widget.export }
                : {}),
        } as ReportConfiguration;

        try {
            return loadDefinition(configuration, { columnsRequired: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid data definition.";
            throw new Error(`Unable to resolve dashboard widget "${widget.id}": ${message}`, { cause: error });
        }
    }

    if (widget.widgetId) {
        return addSharedFilters(getWidgetDefinition(widget.widgetId), [...sharedFilters, ...(widget.runtimeFilters ?? [])]);
    }

    if (widget.reportId) {
        return addSharedFilters(getReport(widget.reportId), [...sharedFilters, ...(widget.runtimeFilters ?? [])]);
    }

    return undefined;
}

/** Resolves data widgets through the same loaded report/query pipeline as reports. */
export function resolveDashboardWidgetRequest(
    widget: DashboardWidget,
    sharedFilters: FilterDefinition[] = []
): WidgetRequest | undefined {
    return resolveDashboardWidgetDefinition(widget, sharedFilters)?.request;
}

/** Resolves optional table presentation columns without changing widget query data. */
export function resolveDashboardWidgetColumns(
    widget: DashboardWidget,
    sharedFilters: FilterDefinition[] = []
): ColumnDefinition[] | undefined {
    return resolveDashboardWidgetDefinition(widget, sharedFilters)?.columns ?? widget.columns;
}

function addSharedFilters(
    definition: ReportDefinition | undefined,
    sharedFilters: FilterDefinition[]
): ReportDefinition | undefined {
    if (!definition || sharedFilters.length === 0) return definition;
    const filters = mergeFilterDefinitions(definition.filters, sharedFilters);
    if (definition.request.action !== "sql" || !definition.queryDefinition) {
        return { ...definition, filters };
    }
    return {
        ...definition,
        filters,
        request: buildSqlResourceRequest({
            queryDefinition: definition.queryDefinition,
            columns: definition.columns,
            filters,
            sort: definition.sort,
            filterLogic: definition.filterLogic,
        } as ReportConfiguration),
    };
}

function mergeFilterDefinitions(
    widgetFilters: FilterDefinition[],
    sharedFilters: FilterDefinition[]
): FilterDefinition[] {
    const merged = new Map(widgetFilters.map(filter => [filter.field, filter]));
    sharedFilters.forEach(filter => merged.set(filter.field, filter));
    return [...merged.values()];
}
