import type { ColumnDefinition } from "../../types/column";

/**
 * A user's personal arrangement of one report's configured columns. Only
 * columns the configuration shows can be arranged: `visible: false` columns
 * are never created, so they cannot be restored here.
 */
export interface ColumnLayout {
    /** Field order; configured fields that are missing keep configured order at the end. */
    order: string[];
    /** Fields the user hid. */
    hidden: string[];
    /** Widths (px) the user set by resizing. */
    widths: Record<string, number>;
}

export interface ArrangedColumn extends ColumnDefinition {
    /** Hidden by the user (still part of the grid, so its sort is kept). */
    hiddenByUser: boolean;
}

export const emptyColumnLayout: ColumnLayout = Object.freeze({ order: [], hidden: [], widths: {} }) as ColumnLayout;

/**
 * Kept per signed-in username and report, like saved views. Browser storage
 * is a convenience, not a security boundary.
 */
const STORAGE_KEY_PREFIX = "generic-report-column-layout:user:";

function storageKey(owner: string, reportId: string) {
    return `${STORAGE_KEY_PREFIX}${encodeURIComponent(owner)}:report:${encodeURIComponent(reportId)}`;
}

export function loadColumnLayout(owner: string, reportId: string): ColumnLayout {
    try {
        const stored = localStorage.getItem(storageKey(owner, reportId));
        return stored ? parseColumnLayout(JSON.parse(stored)) : emptyColumnLayout;
    } catch {
        return emptyColumnLayout;
    }
}

export function saveColumnLayout(owner: string, reportId: string, layout: ColumnLayout): void {
    try {
        if (isEmptyColumnLayout(layout)) localStorage.removeItem(storageKey(owner, reportId));
        else localStorage.setItem(storageKey(owner, reportId), JSON.stringify(layout));
    } catch {
        // Storage unavailable or full: the layout still applies until reload.
    }
}

export function isEmptyColumnLayout(layout: ColumnLayout): boolean {
    return layout.order.length === 0 && layout.hidden.length === 0 && Object.keys(layout.widths).length === 0;
}

/** Accepts only the stored shape; anything else falls back to the configured layout. */
function parseColumnLayout(value: unknown): ColumnLayout {
    if (typeof value !== "object" || value === null) return emptyColumnLayout;
    const record = value as Record<string, unknown>;
    const strings = (list: unknown) => Array.isArray(list)
        ? [...new Set(list.filter((item): item is string => typeof item === "string"))]
        : [];
    const widths: Record<string, number> = {};
    if (typeof record.widths === "object" && record.widths !== null && !Array.isArray(record.widths)) {
        Object.entries(record.widths as Record<string, unknown>).forEach(([field, width]) => {
            if (typeof width === "number" && Number.isInteger(width) && width > 0) widths[field] = width;
        });
    }
    return { order: strings(record.order), hidden: strings(record.hidden), widths };
}

/**
 * Applies a layout to the configured columns. Fields the configuration no
 * longer shows are ignored, new configured fields are appended in configured
 * order, and at least one column always stays visible.
 */
export function arrangeColumns(columns: ColumnDefinition[], layout: ColumnLayout): ArrangedColumn[] {
    const configured = columns.filter(column => column.visible !== false);
    const byField = new Map(configured.map(column => [column.field, column]));
    const ordered = [
        ...layout.order.flatMap(field => byField.get(field) ?? []),
        ...configured.filter(column => !layout.order.includes(column.field)),
    ];
    const hidden = new Set(layout.hidden.filter(field => byField.has(field)));
    if (ordered.length > 0 && ordered.every(column => hidden.has(column.field))) hidden.delete(ordered[0].field);

    return ordered.map(column => ({
        ...column,
        width: layout.widths[column.field] ?? column.width,
        hiddenByUser: hidden.has(column.field),
    }));
}
