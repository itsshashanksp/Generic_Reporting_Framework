import type { KeyboardEvent } from "react";
import { formatNumberForDisplay, NULL_DISPLAY_VALUE } from "../../engine/ValueFormatter";

interface MobileColumn {
    field: string;
    headerName: string;
    sortable: boolean;
}

interface MobileSort {
    field: string;
    direction: "asc" | "desc";
}

interface MobileReportViewProps {
    rows: Record<string, unknown>[];
    columns: MobileColumn[];
    selectable: boolean;
    sort: MobileSort | null;
    isSelected: (row: Record<string, unknown>) => boolean;
    onToggleSelection: (row: Record<string, unknown>) => void;
    onSortFieldChange: (field: string) => void;
    onSortDirectionChange: () => void;
}

function formatValue(value: unknown) {
    if (value === null) return NULL_DISPLAY_VALUE;
    if (value === undefined) return "";
    if (typeof value === "number") return formatNumberForDisplay(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

export default function MobileReportView({
    rows,
    columns,
    selectable,
    sort,
    isSelected,
    onToggleSelection,
    onSortFieldChange,
    onSortDirectionChange,
}: MobileReportViewProps) {
    const sortableColumns = columns.filter(column => column.sortable);
    const handleKeyDown = (
        event: KeyboardEvent<HTMLElement>,
        row: Record<string, unknown>
    ) => {
        if (!selectable || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onToggleSelection(row);
    };

    return (
        <div className="mobile-report-view">
            {sortableColumns.length > 0 && (
                <div className="mobile-report-sort">
                    <label>
                        <span>Sort by</span>
                        <select
                            aria-label="Sort records by"
                            value={sort?.field ?? ""}
                            onChange={event => onSortFieldChange(event.target.value)}
                        >
                            <option value="">Default order</option>
                            {sortableColumns.map(column => (
                                <option key={column.field} value={column.field}>{column.headerName}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        className="app-button"
                        disabled={!sort}
                        aria-label={sort?.direction === "desc" ? "Sort ascending" : "Sort descending"}
                        onClick={onSortDirectionChange}
                    >
                        {sort?.direction === "desc" ? "↓ Desc" : "↑ Asc"}
                    </button>
                </div>
            )}

            <div className="mobile-report-list" role={selectable ? "listbox" : "list"} aria-label="Report records">
                {rows.map((row, rowIndex) => {
                    const selected = isSelected(row);
                    const primaryColumn = columns[0];
                    const secondaryColumn = columns.slice(1).find(column => {
                        const value = row[column.field];
                        return typeof value === "string" && value.trim().length > 0;
                    });
                    const detailColumns = columns
                        .slice(1)
                        .filter(column => column !== secondaryColumn);

                    return (
                        <article
                            key={rowIndex}
                            className="mobile-report-record"
                            data-selected={selected}
                            role={selectable ? "option" : "listitem"}
                            aria-selected={selectable ? selected : undefined}
                            tabIndex={selectable ? 0 : undefined}
                            onClick={selectable ? () => onToggleSelection(row) : undefined}
                            onKeyDown={event => handleKeyDown(event, row)}
                        >
                            {selectable && (
                                <span className="mobile-report-record__selection" aria-hidden="true">
                                    {selected ? "✓" : ""}
                                </span>
                            )}
                            {(primaryColumn || secondaryColumn) && (
                                <header className="mobile-report-record__header">
                                    {primaryColumn && (
                                        <div
                                            className="mobile-report-record__primary"
                                            aria-label={`${primaryColumn.headerName}: ${formatValue(row[primaryColumn.field])}`}
                                        >
                                            {formatValue(row[primaryColumn.field])}
                                        </div>
                                    )}
                                    {secondaryColumn && (
                                        <div
                                            className="mobile-report-record__secondary"
                                            aria-label={`${secondaryColumn.headerName}: ${formatValue(row[secondaryColumn.field])}`}
                                        >
                                            {formatValue(row[secondaryColumn.field])}
                                        </div>
                                    )}
                                </header>
                            )}

                            {detailColumns.length > 0 && (
                                <dl className="mobile-report-record__details">
                                    {detailColumns.map(column => (
                                        <div key={column.field} className="mobile-report-record__field">
                                            <dt>{column.headerName}</dt>
                                            <dd>{formatValue(row[column.field])}</dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
