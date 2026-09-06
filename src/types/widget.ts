import type { ExportConfig } from "./export";
import type { QueryFilter, QuerySort, UniversalQueryRequest } from "./api";
import type { ColumnDefinition } from "./column";
import type {
    ReportPresentationDefinition,
    ReportQueryDefinitionReference,
} from "./report";

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

/** Reusable widget data plus optional shared presentation metadata. */
export type WidgetDefinitionConfiguration =
    Pick<ReportPresentationDefinition, "id" | "title">
    & Partial<Omit<ReportPresentationDefinition, "id" | "title" | "columns">>
    & {
        queryDefinition: ReportQueryDefinitionReference;
        columns?: ColumnDefinition[];
    };

export interface DashboardWidget {
    id: string;

    type: WidgetType;

    title: string;

    description?: string;

    reportId?: string;

    widgetId?: string;

    format?: WidgetFormat;

    /** Response field displayed by a stat widget. */
    valueField?: string;

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
