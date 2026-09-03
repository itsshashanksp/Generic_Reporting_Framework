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

export interface WidgetWhereCondition {
    column: string;
    operator: string;
    value: unknown;
}

export interface WidgetRequest {
    controller: string;
    action: string;
    table: string;

    columns: (
        | string
        | {
              function: string;
              column: string;
              alias?: string;
          }
    )[];

    groupBy?: string[];

    where?: WidgetWhereCondition[];

    sort?: {
        column: string;
        direction: "ASC" | "DESC";
    }[];

    page?: number;

    pageSize?: number;
}

export interface DashboardWidget {
    id: string;

    type: WidgetType;

    title: string;

    description?: string;

    reportId?: string;

    value?: string | number;

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
import type { ExportConfig } from "./export";
