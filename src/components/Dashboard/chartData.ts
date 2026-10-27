import type { ChartOptions } from "../../types/widget";

export interface ChartDatum {
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

const compactNumber = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
});

const tooltipNumber = new Intl.NumberFormat("en", {
    maximumFractionDigits: 3,
});

export function formatChartNumber(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    if (Object.is(numeric, -0)) return "0";
    return compactNumber.format(numeric);
}

export function formatChartTooltipValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    if (Object.is(numeric, -0)) return "0";
    return tooltipNumber.format(numeric);
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
