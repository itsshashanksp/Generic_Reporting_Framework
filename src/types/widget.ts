import type { ExportConfig } from "./export";
import type { QueryFilter, QuerySort, UniversalQueryRequest } from "./api";

export type WidgetType =
    | "report"
    | "stat"
    | "table"
    | "chart";

export type WidgetFormat =
    | "number"
    | "currency"
    | "decimal";

export type ChartType =
    | "bar"
    | "line"
    | "pie";

export interface WidgetRequest extends Omit<UniversalQueryRequest, "filters" | "sort"> {
    filters?: QueryFilter[];
    sort?: QuerySort[];
}

export interface DashboardWidget {
    id: string;

    type: WidgetType;

    title: string;

    description?: string;

    reportId?: string;

    format?: WidgetFormat;

    xField?: string;

    yField?: string;

    chartType?: ChartType;

    showLegend?: boolean;
    showTooltip?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;

    request?: WidgetRequest;

    width?: number;

    height?: number;

    pageSize?: number;

    /** Optional choices shown by a table widget's server-side page-size control. */
    pageSizeOptions?: number[];

    export?: ExportConfig;

    visible?: boolean;

    position?: {
        x: number;
        y: number;
    };
}
