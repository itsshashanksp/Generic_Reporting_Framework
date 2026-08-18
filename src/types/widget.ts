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

export interface DashboardWidget {
    id: string;

    type: WidgetType;

    title: string;

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

    request?: {
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
    };

    width?: number;

    height?: number;

    visible?: boolean;

    position?: {
        x: number;
        y: number;
    };
}