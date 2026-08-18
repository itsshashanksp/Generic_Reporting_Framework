import type { DashboardWidget } from "./widget";
import type { FilterDefinition } from "./filter";

export interface DashboardDefinition {
    id: string;

    title: string;

    description?: string;

    filters?: FilterDefinition[];

    layout?: {
        columns?: number;
        tabletColumns?: number;
        mobileColumns?: number;
    };

    widgets: DashboardWidget[];
}