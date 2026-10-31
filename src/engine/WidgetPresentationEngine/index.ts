import { getChartCapability } from "../../components/Dashboard/chartCapabilities";
import type { ColumnDataType, ColumnDefinition } from "../../types/column";
import type {
    ChartOptions,
    ChartType,
    DashboardWidget,
    WidgetChartPresentation,
    WidgetPresentationView,
} from "../../types/widget";

export interface PresentationAvailability {
    view: WidgetPresentationView;
    label: string;
    available: boolean;
    reason: string | null;
}

export interface ResolvedChartPresentation {
    chartType: ChartType;
    orientation?: NonNullable<ChartOptions["orientation"]>;
    xField: string;
    yField: string;
}

const NUMERIC_TYPES = new Set<ColumnDataType>(["number", "currency", "percentage"]);
const ORDERED_TYPES = new Set<ColumnDataType>(["number", "date", "datetime"]);

export function presentationViewLabel(view: WidgetPresentationView) {
    if (view === "column") return "Column";
    if (view === "radial-bar") return "Radial Bar";
    return view.charAt(0).toUpperCase() + view.slice(1);
}

export function resolveChartPresentation(
    widget: DashboardWidget,
    view: WidgetPresentationView,
): ResolvedChartPresentation | null {
    if (view === "table") return null;
    const chart = widget.presentation?.chart;
    const xField = chart?.xField ?? widget.xField;
    const yField = chart?.yField ?? widget.yField;
    if (!xField || !yField) return null;
    if (view === "column") return { chartType: "bar", orientation: "vertical", xField, yField };
    if (view === "bar") return { chartType: "bar", orientation: "horizontal", xField, yField };
    return { chartType: view, xField, yField };
}

export function getWidgetPresentationAvailability(widget: DashboardWidget): PresentationAvailability[] {
    const presentation = widget.presentation;
    if (!presentation || presentation.allowSwitching === false || !Array.isArray(presentation.allowedViews)) return [];
    return presentation.allowedViews.map(view => {
        const reason = getUnavailableReason(widget, view);
        return {
            view,
            label: presentationViewLabel(view),
            available: reason === null,
            reason,
        };
    });
}

export function getInitialPresentationView(widget: DashboardWidget): WidgetPresentationView {
    const presentation = widget.presentation;
    if (!presentation || presentation.allowSwitching === false) {
        return widget.type === "chart"
            ? widget.chartType === "bar" && widget.chartOptions?.orientation !== "horizontal"
                ? "column"
                : widget.chartType ?? "column"
            : "table";
    }
    const available = getWidgetPresentationAvailability(widget);
    return available.find(option => option.view === presentation.defaultView && option.available)?.view
        ?? available.find(option => option.available)?.view
        ?? (widget.type === "chart" ? widget.chartType ?? "column" : "table");
}

function getUnavailableReason(widget: DashboardWidget, view: WidgetPresentationView): string | null {
    if (widget.type !== "table" && widget.type !== "chart") {
        return "Presentation switching is supported only for table and chart widgets.";
    }
    if (view === "table") {
        const columns = widget.presentation?.table?.columns ?? widget.columns;
        return Array.isArray(columns) && columns.length ? null : "Table view requires authored column metadata.";
    }

    const chart = widget.presentation?.chart;
    if (widget.type === "table" && !hasPresentationSource(chart)) {
        return "Chart view requires an explicit complete or aggregated chart query for a paginated table.";
    }
    const resolved = resolveChartPresentation(widget, view);
    if (!resolved) return "Chart view requires category and numeric value field mappings.";
    const capability = getChartCapability(resolved.chartType);
    if (!capability.supported) return `${capability.label} is not supported.`;
    if (resolved.xField === resolved.yField) return "Chart category and value fields must be different.";

    const columns = chart?.columns ?? (hasPresentationSource(chart) ? undefined : widget.columns);
    if (!Array.isArray(columns) || !columns.length) return null;
    const category = findColumn(columns, resolved.xField);
    const value = findColumn(columns, resolved.yField);
    if (!category) return `Chart category field "${resolved.xField}" is not present in the result metadata.`;
    if (!value) return `Chart value field "${resolved.yField}" is not present in the result metadata.`;
    if (!value.dataType || !NUMERIC_TYPES.has(value.dataType)) {
        return `Chart value field "${resolved.yField}" must be declared as number, currency, or percentage.`;
    }
    if ((resolved.chartType === "line" || resolved.chartType === "area")
        && category.dataType && !ORDERED_TYPES.has(category.dataType)) {
        return `${presentationViewLabel(view)} view requires a date, datetime, or numeric category field.`;
    }
    return null;
}

function hasPresentationSource(value: WidgetChartPresentation | undefined) {
    return value?.queryDefinition !== undefined || value?.request !== undefined;
}

function findColumn(columns: ColumnDefinition[], field: string) {
    return columns.find(column => column.field === field);
}
