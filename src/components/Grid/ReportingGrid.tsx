import { useMemo, useState, type CSSProperties } from "react";

import { buildReportingGridModel, compareGridValues, type ReportingGroupNode } from "../../engine/GridEngine";
import { getContentMinWidth } from "../../engine/GridEngine/contentWidth";
import { formatValueForDisplay } from "../../engine/ValueFormatter";
import type { ColumnDefinition } from "../../types/column";
import type { GroupingConfig } from "../../types/grouping";
import type { GridConfig, SortDefinition } from "../../types/report";
import Pagination from "./Pagination";

type ReportingEntry =
    | { kind: "group"; node: ReportingGroupNode; ancestors: ReportingGroupNode[] }
    | { kind: "continuation"; node: ReportingGroupNode; ancestors: ReportingGroupNode[] }
    | { kind: "detail"; row: Record<string, unknown>; ancestors: ReportingGroupNode[] }
    | { kind: "subtotal"; node: ReportingGroupNode; ancestors: ReportingGroupNode[] };

export default function ReportingGrid({
    rows,
    columns,
    grouping,
    gridConfig,
    height,
    stableViewport = false,
    initialSort = [],
    onSortChange,
}: {
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
    grouping: GroupingConfig;
    gridConfig: GridConfig;
    height?: CSSProperties["height"];
    stableViewport?: boolean;
    initialSort?: SortDefinition[];
    onSortChange?: (sort: Array<{ field: string; direction: "ASC" | "DESC" }>) => void;
}) {
    const [sort, setSort] = useState<SortDefinition | null>(initialSort[0] ?? null);
    const sortedRows = useMemo(() => sort ? [...rows].sort((left, right) => {
        const dataType = columns.find(column => column.field === sort.field)?.dataType;
        const comparison = compareGridValues(left[sort.field], right[sort.field], dataType);
        return sort.direction === "DESC" ? -comparison : comparison;
    }) : rows, [columns, rows, sort]);
    const model = useMemo(() => buildReportingGridModel(sortedRows, grouping, columns, sort ? [sort] : []), [sortedRows, grouping, columns, sort]);
    const [expansion, setExpansion] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(gridConfig.pagination.pageSize);
    const visibleColumns = columns.filter(column => column.visible !== false).map(column => ({
        ...column,
        header: grouping.aggregates?.find(aggregate => aggregate.field === column.field)?.header ?? column.header,
    }));
    const expanded = (id: string) => expansion[id] ?? grouping.expandedByDefault !== false;
    const entries = useMemo(() => {
        const output: ReportingEntry[] = [];
        const append = (nodes: ReportingGroupNode[], ancestors: ReportingGroupNode[]) => nodes.forEach(node => {
            const path = [...ancestors, node];
            output.push({ kind: "group", node, ancestors });
            if (!expanded(node.id)) return;
            if (grouping.showSubtotals !== false && grouping.subtotalPosition === "top") output.push({ kind: "subtotal", node, ancestors: path });
            if (node.children.length) append(node.children, path);
            else node.rows.forEach(row => output.push({ kind: "detail", row, ancestors: path }));
            if (grouping.showSubtotals !== false && grouping.subtotalPosition !== "top") output.push({ kind: "subtotal", node, ancestors: path });
        });
        append(model.groups, []);
        return output;
        // expansion is a stable primitive map owned by this component.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model.groups, grouping.expandedByDefault, grouping.showSubtotals, grouping.subtotalPosition, expansion]);
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
    const activePage = Math.min(page, totalPages);
    const pageEntries = entries.slice((activePage - 1) * pageSize, activePage * pageSize);
    const first = pageEntries[0];
    const continuationHeaders = first
        ? first.ancestors.map(node => ({ kind: "continuation" as const, node, ancestors: [] }))
        : [];
    const displayedEntries = [...continuationHeaders, ...pageEntries];

    const labelColumn = visibleColumns.find(column => !Object.prototype.hasOwnProperty.call(model.grandTotal, column.field)) ?? visibleColumns[0];
    const aggregateRowsForWidth = useMemo(() => {
        const aggregates: Record<string, unknown>[] = [model.grandTotal];
        const append = (nodes: ReportingGroupNode[]) => nodes.forEach(node => {
            aggregates.push(node.aggregates);
            append(node.children);
        });
        append(model.groups);
        return [...rows, ...aggregates];
    }, [model, rows]);
    const columnWidths = visibleColumns.map(column => {
        const contentWidth = getContentMinWidth(
            aggregateRowsForWidth,
            column.field,
            column.header,
            column.sortable !== false,
            undefined,
            column.dataType,
        );
        if (grouping.groups?.some(group => group.field === column.field)) return Math.min(170, Math.max(110, contentWidth));
        if (grouping.aggregates?.some(aggregate => aggregate.field === column.field)) return Math.max(140, contentWidth);
        return undefined;
    });
    const minimumTableWidth = columnWidths.reduce<number>((total, width) => total + (width ?? 120), 0);
    const renderAggregateCells = (values: Record<string, number | null>, label: string) => visibleColumns.map(column => (
        <td key={column.field} className={`reporting-grid__cell reporting-grid__cell--${column.align ?? (column.dataType === "number" || column.dataType === "currency" ? "right" : "left")}`}>
            {column.field === labelColumn?.field ? label : Object.prototype.hasOwnProperty.call(values, column.field) ? formatValueForDisplay(values[column.field], column.dataType) : ""}
        </td>
    ));

    const renderGroupCells = (node: ReportingGroupNode, isExpanded: boolean) => {
        const groupLabelField = visibleColumns.some(column => column.field === node.field)
            ? node.field
            : labelColumn?.field;
        return visibleColumns.map(column => {
            if (column.field === groupLabelField) return <th key={column.field} scope="rowgroup">
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label} group`}
                    style={{ paddingInlineStart: `${12 + node.depth * 20}px` }}
                    onClick={() => {
                        setExpansion(current => ({ ...current, [node.id]: !isExpanded }));
                        setPage(1);
                    }}
                ><span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>{node.label}</button>
            </th>;
            const hasAggregate = grouping.showGroupTotalsInHeader === true
                && Object.prototype.hasOwnProperty.call(node.aggregates, column.field);
            return <td key={column.field} className={`reporting-grid__group-total reporting-grid__cell reporting-grid__cell--${column.align ?? (column.dataType === "number" || column.dataType === "currency" ? "right" : "left")}`}>
                {hasAggregate ? formatValueForDisplay(node.aggregates[column.field], column.dataType) : ""}
            </td>;
        });
    };

    return <div
        className="universal-grid universal-grid--reporting"
        data-grid-sizing={stableViewport ? "bounded" : "natural"}
        data-visible-rows={displayedEntries.length + (grouping.showGrandTotal === false ? 0 : 1)}
    >
        <div className="reporting-grid__scroll" style={height === undefined
            ? undefined
            : stableViewport
                ? { height }
                : { maxHeight: height }}>
            <table className="reporting-grid" style={{ "--reporting-grid-min-width": `${minimumTableWidth}px` } as CSSProperties}>
                <colgroup>{visibleColumns.map((column, index) => <col key={column.field} style={columnWidths[index] ? { width: `${columnWidths[index]}px` } : undefined} />)}</colgroup>
                <thead><tr>{visibleColumns.map(column => <th key={column.field} scope="col">
                    {column.sortable === false ? column.header : <button type="button" onClick={() => {
                        const nextSort: SortDefinition = sort?.field === column.field
                            ? { field: column.field, direction: sort.direction === "ASC" ? "DESC" : "ASC" }
                            : { field: column.field, direction: "ASC" };
                        setSort(nextSort);
                        onSortChange?.([nextSort]);
                        setPage(1);
                    }}>{column.header}{sort?.field === column.field ? <span aria-label={sort.direction === "ASC" ? "sorted ascending" : "sorted descending"}>{sort.direction === "ASC" ? " ▲" : " ▼"}</span> : null}</button>}
                </th>)}</tr></thead>
                <tbody>
                    {displayedEntries.map((entry, index) => {
                        if (entry.kind === "continuation") return <tr className="reporting-grid__continuation" key={`${entry.node.id}-continuation-${index}`}>
                            <th colSpan={visibleColumns.length} scope="row" style={{ paddingInlineStart: `${12 + entry.node.depth * 20}px` }}>{entry.node.label} (continued)</th>
                        </tr>;
                        if (entry.kind === "group") {
                            const isExpanded = expanded(entry.node.id);
                            return <tr className="reporting-grid__group" key={`${entry.node.id}-${index}`}>
                                {renderGroupCells(entry.node, isExpanded)}
                            </tr>;
                        }
                        if (entry.kind === "subtotal") return <tr className="reporting-grid__subtotal" key={`${entry.node.id}-subtotal-${index}`} aria-label={`${entry.node.label} subtotal`}>
                            {renderAggregateCells(entry.node.aggregates, `${entry.node.label} Subtotal`)}
                        </tr>;
                        return <tr className="reporting-grid__detail" key={`detail-${(activePage - 1) * pageSize + index}`}>
                            {visibleColumns.map(column => {
                                const formatted = formatValueForDisplay(entry.row[column.field], column.dataType);
                                return <td key={column.field} title={formatted} className={`reporting-grid__cell reporting-grid__cell--${column.align ?? (column.dataType === "number" || column.dataType === "currency" ? "right" : "left")}`}>{formatted}</td>;
                            })}
                        </tr>;
                    })}
                </tbody>
                {grouping.showGrandTotal !== false && <tfoot><tr className="reporting-grid__grand-total" aria-label="Grand Total">{renderAggregateCells(model.grandTotal, "Grand Total")}</tr></tfoot>}
            </table>
        </div>
        {gridConfig.pagination.enabled && <Pagination
            page={activePage}
            pageSize={pageSize}
            pageSizeOptions={gridConfig.pagination.pageSizeOptions}
            totalRows={entries.length}
            rowsOnPage={pageEntries.length}
            disabled={false}
            config={gridConfig.pagination}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); }}
            className="universal-grid__pagination--client"
        />}
    </div>;
}
