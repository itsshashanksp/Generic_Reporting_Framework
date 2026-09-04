import type { DashboardDefinition } from "../../types/dashboard";

import {
    validateDashboard,
} from "../DashboardValidator";
import type {
    DashboardValidationResult,
} from "../DashboardValidator";
import { loadFilters } from "../FilterEngine";

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
            dashboardConfiguration
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
            registry[dashboard.id] = dashboard;
        }
    });

    return registry;
}
