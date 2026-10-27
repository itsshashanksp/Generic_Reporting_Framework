import type { ExportConfig } from "./export";
import type { DataRequest } from "./api";
import type { ColumnDefinition } from "./column";
import type { FilterDefinition } from "./filter";
import type {
    ReportPresentationDefinition,
    ReportQueryDefinitionReference,
    PaginationPresentationConfig,
} from "./report";

export type WidgetType =
    | "report"
    | "stat"
    | "table"
    | "chart";

export type WidgetFormat =
    | "number"
    | "currency"
    | "decimal"
    | "percentage";

export type ChartType =
    | "bar"
    | "line"
    | "pie";

export interface ChartOptions {
    appearance?: "pie" | "donut";
    orientation?: "vertical" | "horizontal";
    showLegend?: boolean;
    showLabels?: boolean;
    showDataLabels?: boolean;
    showCenterTotal?: boolean;
    showGrid?: boolean;
    smooth?: boolean;
    showPoints?: boolean;
    topN?: number;
    showOthers?: boolean;
    othersLabel?: string;
}

export type WidgetRequest = DataRequest;

/** Reusable widget data plus optional shared presentation metadata. */
export type WidgetDefinitionConfiguration =
    Pick<ReportPresentationDefinition, "id" | "title">
    & Partial<Omit<ReportPresentationDefinition, "id" | "title" | "columns">>
    & {
        queryDefinition: ReportQueryDefinitionReference;
        columns?: ColumnDefinition[];
    };

export interface DashboardWidgetPresentation {
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

    chartOptions?: ChartOptions;

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

    /** Modern table pagination. Its pageSize overrides the legacy pageSize. */
    pagination?: PaginationPresentationConfig;

    export?: ExportConfig;

    visible?: boolean;

    /**
     * Renames shared dashboard filter fields for this widget only, e.g.
     * `{ "Bill_Date": "GIN_Date" }`: one dashboard input filters a resource
     * whose column has another name. A field-name mapping, never SQL.
     */
    filterFields?: Record<string, string>;

    /** Runtime controls whose values apply only to this dashboard widget. */
    runtimeFilters?: FilterDefinition[];

    /** Widget-local runtime filter presentation; omitted preserves inline mode. */
    runtimeFilterDisplay?: "inline" | "dialog";

    position?: {
        x: number;
        y: number;
    };
}

/**
 * Dashboard-owned layout combined with an optional inline reusable widget
 * definition. `widgetId` remains available for registry-backed widgets.
 */
export type DashboardWidget = DashboardWidgetPresentation
    & Partial<Omit<
        WidgetDefinitionConfiguration,
        "id" | "title" | "description" | "export"
    >>;
