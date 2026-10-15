import type { DashboardWidget } from "./widget";
import type { FilterDefinition } from "./filter";

/** How a dashboard treats its shared `daterange` filters (see docs/DASHBOARDS.md). */
export type DashboardDateFilterBehavior = "required" | "optional";

export interface DashboardDefinition {
    id: string;

    title: string;

    description?: string;

    filters?: FilterDefinition[];

    /**
     * `"required"`: nothing loads until Search applies both dates of every
     * shared date range. `"optional"`: loads without a date filter; Search
     * applies a range only with both dates. Omitted: filters behave as
     * configured (a `required` filter still holds the dashboard back).
     */
    dateFilterBehavior?: DashboardDateFilterBehavior;

    layout?: {
        columns?: number;
        tabletColumns?: number;
        mobileColumns?: number;
    };

    autoRefresh?: {
        enabled?: boolean;
        interval?: number;
    };

    widgets: DashboardWidget[];
}