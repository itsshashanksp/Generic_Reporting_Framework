import type { ColumnDefinition } from "../../types/column";
import type { AggregateDefinition, GroupingConfig } from "../../types/grouping";
import { formatValueForDisplay } from "../ValueFormatter";
import { compareGridValues } from "./sorting";

export interface ReportingGroupNode {
    id: string;
    depth: number;
    field: string;
    value: unknown;
    label: string;
    rows: Record<string, unknown>[];
    children: ReportingGroupNode[];
    aggregates: Record<string, number | null>;
}

export interface ReportingGridModel {
    groups: ReportingGroupNode[];
    grandTotal: Record<string, number | null>;
}

function numeric(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function stableValue(value: unknown) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "number") return `number:${Number.isNaN(value) ? "nan" : String(value)}`;
    return `${typeof value}:${JSON.stringify(value)}`;
}

function displayGroupValue(value: unknown, column?: ColumnDefinition) {
    if (value === null || value === undefined || value === "") return "(Blank)";
    return formatValueForDisplay(value, column?.dataType);
}

/** Kahan summation limits avoidable binary drift without changing source values. */
function sum(values: number[]) {
    let total = 0;
    let compensation = 0;
    values.forEach(value => {
        const adjusted = value - compensation;
        const next = total + adjusted;
        compensation = next - total - adjusted;
        total = next;
    });
    return total;
}

export function aggregateRows(rows: Record<string, unknown>[], definitions: AggregateDefinition[]) {
    return Object.fromEntries(definitions.map(definition => {
        const outputField = definition.field;
        if (definition.function === "COUNT") {
            return [outputField, rows.reduce((count, row) => row[definition.field] !== null && row[definition.field] !== undefined ? count + 1 : count, 0)];
        }
        const values = rows.map(row => numeric(row[definition.field])).filter((value): value is number => value !== null);
        if (!values.length) return [outputField, null];
        if (definition.function === "SUM") return [outputField, sum(values)];
        if (definition.function === "AVG") return [outputField, sum(values) / values.length];
        if (definition.function === "MIN") return [outputField, Math.min(...values)];
        return [outputField, Math.max(...values)];
    }));
}

export function buildReportingGridModel(
    rows: Record<string, unknown>[],
    grouping: GroupingConfig,
    columns: ColumnDefinition[],
    sort: Array<{ field: string; direction: "ASC" | "DESC" }> = [],
): ReportingGridModel {
    const groups = grouping.groups ?? [];
    const aggregates = grouping.aggregates ?? [];
    const columnByField = new Map(columns.map(column => [column.field, column]));
    const buildLevel = (levelRows: Record<string, unknown>[], depth: number, parentId: string): ReportingGroupNode[] => {
        const group = groups[depth];
        if (!group) return [];
        const partitions = new Map<string, { value: unknown; rows: Record<string, unknown>[] }>();
        levelRows.forEach(row => {
            const value = row[group.field];
            const key = stableValue(value);
            const partition = partitions.get(key) ?? { value, rows: [] };
            partition.rows.push(row);
            partitions.set(key, partition);
        });
        const groupDirection = sort.find(item => item.field === group.field)?.direction ?? "ASC";
        return [...partitions.entries()].sort(([, left], [, right]) => {
            const comparison = compareGridValues(left.value, right.value, columnByField.get(group.field)?.dataType);
            return groupDirection === "DESC" ? -comparison : comparison;
        }).map(([key, partition]) => {
            const id = `${parentId}/${encodeURIComponent(group.field)}=${encodeURIComponent(key)}`;
            return {
                id,
                depth,
                field: group.field,
                value: partition.value,
                label: displayGroupValue(partition.value, columnByField.get(group.field)),
                rows: partition.rows,
                children: buildLevel(partition.rows, depth + 1, id),
                aggregates: aggregateRows(partition.rows, aggregates),
            };
        });
    };
    return { groups: buildLevel(rows, 0, "group"), grandTotal: aggregateRows(rows, aggregates) };
}

export function buildReportingExportRows(
    rows: Record<string, unknown>[],
    grouping: GroupingConfig,
    columns: ColumnDefinition[],
    sort: Array<{ field: string; direction: "ASC" | "DESC" }> = [],
) {
    const model = buildReportingGridModel(rows, grouping, columns, sort);
    const output: Record<string, unknown>[] = [];
    const labelField = columns.find(column => column.visible !== false)?.field ?? "Group";
    const append = (nodes: ReportingGroupNode[]) => nodes.forEach(node => {
        output.push({ [labelField]: `${"  ".repeat(node.depth)}${node.label}` });
        if (node.children.length) append(node.children);
        else output.push(...node.rows.map(row => ({ ...row })));
        if (grouping.showSubtotals !== false) output.push({ [labelField]: `${"  ".repeat(node.depth)}${node.label} Subtotal`, ...node.aggregates });
    });
    append(model.groups);
    if (grouping.showGrandTotal !== false) output.push({ [labelField]: "Grand Total", ...model.grandTotal });
    return output;
}
