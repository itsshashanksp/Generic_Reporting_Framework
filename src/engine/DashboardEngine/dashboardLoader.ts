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
    "../../config/dashboards/*.json",
    { eager: true, import: "default" }
) as Record<string, unknown>;

const dashboards = buildDashboardRegistry(dashboardModules);

export function getDashboard(
    dashboardId: string
): DashboardLoadResult {

    const dashboardConfiguration =
        dashboards[dashboardId];

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
            filters: loadFilters(
                (dashboardConfiguration as DashboardDefinition).filters ?? []
            ),
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

/** Resolves inline definitions first, then existing report/widget references. */
export function resolveDashboardWidgetDefinition(
    widget: DashboardWidget,
    sharedFilters: FilterDefinition[] = []
): ReportDefinition | undefined {
    const filters = mergeFilterDefinitions(widget.filters ?? [], sharedFilters);
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
            ...(widget.export !== undefined ? { export: widget.export } : {}),
        } as ReportConfiguration;

        return loadDefinition(configuration, { columnsRequired: false });
    }

    if (widget.widgetId) {
        return addSharedFilters(getWidgetDefinition(widget.widgetId), sharedFilters);
    }

    if (widget.reportId) {
        return addSharedFilters(getReport(widget.reportId), sharedFilters);
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
