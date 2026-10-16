import AccessibleDialog from "../Common/AccessibleDialog";
import type { ArrangedColumn } from "../../engine/ColumnLayoutEngine";

interface ColumnChooserDialogProps {
    reportTitle: string;
    columns: ArrangedColumn[];
    /** True when the user's layout differs from the configured one. */
    customized: boolean;
    onToggle: (field: string) => void;
    onMove: (field: string, offset: -1 | 1) => void;
    onReset: () => void;
    onClose: () => void;
}

/** Show, hide, and reorder a report's configured columns; changes apply immediately. */
export default function ColumnChooserDialog({
    reportTitle,
    columns,
    customized,
    onToggle,
    onMove,
    onReset,
    onClose,
}: ColumnChooserDialogProps) {
    const visibleCount = columns.filter(column => !column.hiddenByUser).length;

    return (
        <AccessibleDialog title={`Columns — ${reportTitle}`} onClose={onClose} className="column-chooser">
            <p className="column-chooser__hint">
                Changes apply immediately and are kept for your account in this browser. Drag headers to reorder and drag their edges to resize.
            </p>
            <ol className="column-chooser__list">
                {columns.map((column, index) => {
                    const lastVisible = !column.hiddenByUser && visibleCount === 1;
                    return (
                        <li key={column.field} className="column-chooser__item">
                            <label className="column-chooser__label">
                                <input
                                    type="checkbox"
                                    checked={!column.hiddenByUser}
                                    disabled={lastVisible}
                                    onChange={() => onToggle(column.field)}
                                    aria-describedby={lastVisible ? "column-chooser-last" : undefined}
                                />
                                {column.header}
                            </label>
                            <span className="column-chooser__move">
                                <button
                                    type="button"
                                    className="app-button"
                                    aria-label={`Move ${column.header} up`}
                                    disabled={index === 0}
                                    onClick={() => onMove(column.field, -1)}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    className="app-button"
                                    aria-label={`Move ${column.header} down`}
                                    disabled={index === columns.length - 1}
                                    onClick={() => onMove(column.field, 1)}
                                >
                                    ↓
                                </button>
                            </span>
                        </li>
                    );
                })}
            </ol>
            {visibleCount === 1 && (
                <p id="column-chooser-last" className="column-chooser__hint">At least one column must stay visible.</p>
            )}
            <div className="column-chooser__actions">
                <button type="button" className="app-button" disabled={!customized} onClick={onReset}>
                    Reset columns
                </button>
                <button type="button" className="app-button app-button--primary" onClick={onClose}>
                    Done
                </button>
            </div>
        </AccessibleDialog>
    );
}
