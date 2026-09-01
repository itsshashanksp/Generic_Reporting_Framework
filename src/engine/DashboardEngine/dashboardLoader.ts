import type { DashboardDefinition } from "../../types/dashboard";

import customerDashboard from "../../config/dashboards/customer.json";

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

const dashboards: Record<
    string,
    unknown
> = {
    [getDashboardId(
        customerDashboard,
        "customer-dashboard"
    )]: customerDashboard,
};

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

function getDashboardId(
    dashboard: unknown,
    fallbackId: string
) {
    if (
        typeof dashboard === "object" &&
        dashboard !== null &&
        "id" in dashboard &&
        typeof dashboard.id === "string" &&
        dashboard.id.length > 0
    ) {
        return dashboard.id;
    }

    return fallbackId;
}
