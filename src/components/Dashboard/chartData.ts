import { formatCurrencyForDisplay, formatNumberForDisplay } from "../../engine/ValueFormatter";
import type { ChartOptions, ChartType } from "../../types/widget";

export interface ChartDatum {
    [key: string]: string | number | null;
    name: string;
    value: number | null;
}

const MINIMUM_HORIZONTAL_CHART_HEIGHT = 260;
const HORIZONTAL_BAR_ROW_HEIGHT = 36;
const HORIZONTAL_CHART_VERTICAL_CHROME = 76;

/** Keeps every category readable; the chart viewport scrolls when its card is shorter. */
export function getHorizontalBarChartHeight(categoryCount: number): number {
    const count = Number.isFinite(categoryCount) ? Math.max(0, Math.floor(categoryCount)) : 0;
    return Math.max(MINIMUM_HORIZONTAL_CHART_HEIGHT, count * HORIZONTAL_BAR_ROW_HEIGHT + HORIZONTAL_CHART_VERTICAL_CHROME);
}

/** Reserves label room while allowing long category names to use more axis space. */
export function getHorizontalCategoryAxisWidth(data: ChartDatum[]): number {
    const longest = data.reduce((length, item) => Math.max(length, item.name.length), 0);
    return Math.min(190, Math.max(110, longest * 6.5 + 18));
}

export interface ChartOverflowLayout {
    axis: "none" | "horizontal" | "vertical";
    minimumWidth?: number;
    minimumHeight?: number;
}

export interface ChartPresentationItem {
    category: string;
    originalValue: number | null;
    formattedValue: string;
    percentage: string | null;
}

/**
 * Keeps category marks readable without changing the dashboard card size.
 * Proportional, hierarchical and radial charts adapt in place; cartesian
 * charts get a bounded scrolling canvas only after category density exceeds
 * the space an ordinary widget can reasonably display.
 */
export function getChartOverflowLayout(
    type: "bar" | "line" | "area" | "pie" | "doughnut" | "treemap" | "funnel" | "radial-bar",
    orientation: "vertical" | "horizontal",
    data: ChartDatum[],
    policy: "orientation-aware" | "horizontal" | "adapt" = type === "bar"
        ? "orientation-aware"
        : type === "line" || type === "area" ? "horizontal" : "adapt",
    options?: ChartOptions,
): ChartOverflowLayout {
    if (policy === "adapt") return { axis: "none" };
    if (policy === "orientation-aware" && orientation === "horizontal") {
        return data.length > 6
            ? { axis: "vertical", minimumHeight: getHorizontalBarChartHeight(data.length) }
            : { axis: "none" };
    }
    if (policy === "orientation-aware" || policy === "horizontal") {
        if (data.length <= 8) return { axis: "none" };
        const longestLabel = data.reduce((length, item) => Math.max(length, item.name.length), 0);
        const longestValue = data.reduce((length, item) => Math.max(length, formatChartNumber(item.value, options).length), 0);
        const categoryWidth = type === "bar" ? 62 : 48;
        const longLabelAllowance = Math.min(24, Math.max(0, longestLabel - 12));
        const endpointAllowance = Math.min(96, Math.max(24, longestValue * 7 + 12));
        return {
            axis: "horizontal",
            minimumWidth: Math.min(2400, data.length * (categoryWidth + longLabelAllowance) + 72 + endpointAllowance),
        };
    }
    return { axis: "none" };
}

export function formatChartCategoryLabel(value: unknown, maximumLength = 18): string {
    const label = String(value ?? "");
    return label.length > maximumLength ? `${label.slice(0, Math.max(1, maximumLength - 1))}…` : label;
}

const compactNumber = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 2,
});

function formatIndianCompact(value: number): string {
    const absolute = Math.abs(value);
    const unit = absolute >= 10_000_000 ? { divisor: 10_000_000, suffix: "Cr" }
        : absolute >= 100_000 ? { divisor: 100_000, suffix: "L" }
            : absolute >= 1_000 ? { divisor: 1_000, suffix: "K" }
                : null;
    if (!unit) return formatNumberForDisplay(value);
    return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value / unit.divisor)} ${unit.suffix}`;
}

function formatChartFullValue(value: number, options?: ChartOptions): string {
    if (options?.valueFormat === "currency") return formatCurrencyForDisplay(value, "standard", options.currency);
    if (options?.valueFormat === "decimal") return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return formatNumberForDisplay(value);
}

export function formatChartNumber(value: unknown, options?: ChartOptions): string {
    if (value === null || value === undefined || value === "") return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    if (Object.is(numeric, -0)) return "0";
    if (options?.numberFormat === "full") return formatChartFullValue(numeric, options);
    if (options?.valueFormat === "currency") return formatCurrencyForDisplay(numeric, "compact-indian", options.currency);
    const formatted = options?.numberFormat === "compact" ? compactNumber.format(numeric) : formatIndianCompact(numeric);
    return formatted;
}

export function formatChartTooltipValue(value: unknown, options?: ChartOptions): string {
    if (value === null || value === undefined || value === "") return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    if (Object.is(numeric, -0)) return "0";
    return formatChartFullValue(numeric, options);
}

/** Explicit flags win; otherwise each visualization receives a readable framework default. */
export function resolveChartLabelVisibility(
    type: ChartType,
    dataLength: number,
    options?: ChartOptions,
    configured?: boolean,
): boolean {
    const explicit = options?.showLabels ?? options?.showDataLabels ?? configured;
    if (explicit !== undefined) return explicit;
    if (type === "bar" || type === "pie" || type === "doughnut" || type === "radial-bar") return true;
    if (type === "line" || type === "area") return dataLength <= 8;
    return false;
}

/**
 * Adds bounded plot headroom for persistent labels without changing source values.
 * Zero remains an anchor for one-sided datasets; signed datasets receive room at
 * both ends so negative and positive labels stay inside the SVG viewport.
 */
export function getChartValueDomain(data: ChartDatum[], labelsVisible: boolean): [number, number] {
    const values = data.flatMap(item => item.value === null || !Number.isFinite(item.value) ? [] : [item.value]);
    if (!values.length) return [0, 1];
    const minimum = Math.min(...values, 0);
    const maximum = Math.max(...values, 0);
    if (minimum === 0 && maximum === 0) return [0, 1];
    if (!labelsVisible) return [minimum, maximum || 1];
    const span = Math.max(1, maximum - minimum, Math.abs(maximum), Math.abs(minimum));
    const padding = span * 0.12;
    return [minimum < 0 ? minimum - padding : 0, maximum > 0 ? maximum + padding : 0];
}

export function getProportionalChartTotal(data: ChartDatum[]): number {
    return data.reduce((sum, item) => sum + Math.max(0, item.value ?? 0), 0);
}

export function formatChartPercentage(value: unknown, total: number): string | null {
    const numeric = Number(value);
    if (!(total > 0) || !Number.isFinite(numeric) || numeric < 0) return null;
    return `${(numeric / total * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
}

export function buildChartPresentation(
    data: ChartDatum[],
    options?: ChartOptions,
    proportional = false,
): ChartPresentationItem[] {
    const total = proportional ? getProportionalChartTotal(data) : 0;
    return data.map(item => ({
        category: item.name,
        originalValue: item.value,
        formattedValue: formatChartTooltipValue(item.value, options),
        percentage: proportional ? formatChartPercentage(item.value, total) : null,
    }));
}

/** Bounded text alternative shared by every chart renderer. */
export function describeChartData(data: ChartDatum[], options?: ChartOptions, proportional = false): string {
    const presentation = buildChartPresentation(data, options, proportional);
    const entries = presentation.slice(0, 20).map(item => {
        return `${item.category}: ${item.formattedValue}${item.percentage ? ` (${item.percentage})` : ""}`;
    });
    if (data.length > entries.length) entries.push(`${data.length - entries.length} additional categories`);
    return entries.join("; ");
}

/**
 * Chooses external pie labels using the rendered radius. Candidates need
 * enough arc length for a label and enough vertical separation on their side
 * of the pie. Larger slices win collisions, so narrow containers suppress
 * lower-priority labels instead of drawing an unreadable cluster.
 */
export function getVisiblePieLabelIndexes(data: ChartDatum[], outerRadius: number): Set<number> {
    const values = data.map(item => Math.max(0, item.value ?? 0));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!(total > 0) || !(outerRadius > 0)) return new Set();

    let angle = 90;
    const labelRadius = outerRadius + 16;
    const candidates = values.flatMap((value, index) => {
        const sweep = value / total * 360;
        const midAngle = angle - sweep / 2;
        angle -= sweep;
        const arcLength = value / total * 2 * Math.PI * outerRadius;
        if (arcLength < 18) return [];
        const radians = -midAngle * Math.PI / 180;
        return [{ index, value, side: Math.cos(radians) >= 0 ? "right" : "left", y: Math.sin(radians) * labelRadius }];
    }).sort((left, right) => right.value - left.value || left.index - right.index);

    const selected: typeof candidates = [];
    const maximumLabels = Math.max(2, Math.floor(outerRadius * 2 / 22));
    for (const candidate of candidates) {
        if (selected.length >= maximumLabels) break;
        if (selected.some(item => item.side === candidate.side && Math.abs(item.y - candidate.y) < 18)) continue;
        selected.push(candidate);
    }
    return new Set(selected.map(item => item.index));
}

export function mapChartData(rows: Record<string, unknown>[], xField: string, yField: string): ChartDatum[] {
    return rows.map(row => {
        const raw = row[yField];
        const numeric = raw === null || raw === undefined || raw === "" ? null : Number(raw);
        return {
            name: String(row[xField] ?? "").trim() || "Uncategorized",
            value: numeric !== null && Number.isFinite(numeric) ? numeric : null,
        };
    });
}

export function isLikelyOrderedChartDimension(data: ChartDatum[]): boolean {
    if (data.length < 2) return true;
    return data.every(item => /^-?\d+(?:\.\d+)?$/.test(item.name)
        || /^\d{4}-\d{2}(?:-\d{2})?(?:[T ].*)?$/.test(item.name));
}

/**
 * Top-N ranks signed aggregate values descending. Duplicate categories are
 * summed only when Top-N is enabled. Equal values retain first-seen order.
 * Missing numeric values do not contribute to aggregates.
 */
export function applyChartTopN(data: ChartDatum[], options?: ChartOptions): ChartDatum[] {
    if (!options?.topN || data.length <= options.topN) return data.map(item => ({ ...item }));
    const grouped = new Map<string, { value: number | null; index: number }>();
    data.forEach((item, index) => {
        const current = grouped.get(item.name);
        if (!current) {
            grouped.set(item.name, { value: item.value, index });
        } else if (item.value !== null) {
            current.value = (current.value ?? 0) + item.value;
        }
    });
    const ranked = [...grouped.entries()]
        .map(([name, item]) => ({ name, value: item.value, index: item.index }))
        .sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY) || left.index - right.index);
    const selected = ranked.slice(0, options.topN).map(({ name, value }) => ({ name, value }));
    const remaining = ranked.slice(options.topN);
    if (options.showOthers && remaining.length) {
        const numeric = remaining.filter(item => item.value !== null);
        selected.push({
            name: options.othersLabel?.trim() || "Others",
            value: numeric.length ? numeric.reduce((sum, item) => sum + (item.value ?? 0), 0) : null,
        });
    }
    return selected;
}
