import type { ChartOptions } from "../../types/widget";

export interface ChartDatum {
    name: string;
    value: number | null;
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
