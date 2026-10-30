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
    | "area"
    | "pie"
    | "doughnut"
    | "treemap"
    | "funnel"
    | "radial-bar";

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
    /** Axis notation; defaults to Indian compact notation for dashboard readability. */
    numberFormat?: "full" | "compact" | "compact-indian";
    /** Numeric value presentation shared by axes, labels and tooltips. */
    valueFormat?: "number" | "decimal" | "currency";
    /** ISO 4217 display code when valueFormat is currency; defaults to INR. */
    currency?: string;
    /** Stable data-series keys mapped to six-digit HEX colors. */
    seriesColors?: Record<string, string>;
    /** Stable pie category values mapped to six-digit HEX colors. */
    categoryColors?: Record<string, string>;
}

export interface ChartCustomizationDefaults {
    chartType: ChartType;
    orientation?: ChartOptions["orientation"];
    numberFormat?: ChartOptions["numberFormat"];
    valueFormat?: ChartOptions["valueFormat"];
    seriesColors?: Record<string, string>;
    categoryColors?: Record<string, string>;
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

    /** ISO 4217 display code for a currency stat; defaults to INR. */
    currency?: string;

    /** Response field displayed by a stat widget. */
    valueField?: string;

    xField?: string;

    yField?: string;

    chartType?: ChartType;

    chartOptions?: ChartOptions;

    /** Backend-owned snapshot used to restore authored chart presentation. */
    chartCustomizationDefaults?: ChartCustomizationDefaults;

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

    /** Shared page-filter fields omitted from this widget's requests. */
    pageFilterExclusions?: string[];

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
