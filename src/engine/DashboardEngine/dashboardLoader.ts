import type { DashboardDefinition } from "../../types/dashboard";

import customerDashboard from "../../config/dashboards/customer.json";

const dashboards: Record<string, DashboardDefinition> = {
    [customerDashboard.id]:
        customerDashboard as DashboardDefinition,
};

export function getDashboard(
    dashboardId: string
): DashboardDefinition | null {

    return dashboards[dashboardId] ?? null;
}