import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Filter } from "lucide-react";

import { FilterProvider, useFilters, type FilterValues } from "../../engine/FilterContext";
import { getFilterValueErrors, isEmptyFilterValue } from "../../engine/FilterEngine";
import type { FilterDefinition } from "../../types/filter";
import FilterRenderer from "../Filters/FilterRenderer";
import AccessibleDialog from "../Common/AccessibleDialog";

export interface WidgetFilterControls {
    appliedValues: FilterValues;
    button: ReactNode;
    panel: ReactNode;
}

export default function WidgetFilterController({
    filters,
    database,
    widgetTitle,
    children,
    display = "inline",
    appliedValues,
    onAppliedValuesChange,
}: {
    filters: FilterDefinition[];
    database?: string;
    widgetTitle: string;
    display?: "inline" | "dialog";
    appliedValues?: FilterValues;
    onAppliedValuesChange?: (values: FilterValues) => void;
    children: (controls: WidgetFilterControls) => ReactNode;
}) {
    return (
        <FilterProvider>
            <WidgetFilterControllerContent filters={filters} database={database} widgetTitle={widgetTitle} display={display}
                appliedValues={appliedValues} onAppliedValuesChange={onAppliedValuesChange}>
                {children}
            </WidgetFilterControllerContent>
        </FilterProvider>
    );
}

function WidgetFilterControllerContent({
    filters: definitions,
    database,
    widgetTitle,
    children,
    display,
    appliedValues: controlledAppliedValues,
    onAppliedValuesChange,
}: {
    filters: FilterDefinition[];
    database?: string;
    widgetTitle: string;
    display: "inline" | "dialog";
    appliedValues?: FilterValues;
    onAppliedValuesChange?: (values: FilterValues) => void;
    children: (controls: WidgetFilterControls) => ReactNode;
}) {
    const { filters, clearFilters, replaceFilters } = useFilters();
    const [internalAppliedValues, setInternalAppliedValues] = useState<FilterValues>({});
    const appliedValues = controlledAppliedValues ?? internalAppliedValues;
    const setAppliedValues = useCallback((values: FilterValues) => {
        setInternalAppliedValues(values);
        onAppliedValuesChange?.(values);
    }, [onAppliedValuesChange]);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState("");
    const panelId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const previousDatabase = useRef(database);
    const visibleFilters = definitions.filter(filter => filter.visible !== false);
    const active = Object.values(appliedValues).some(value => !isEmptyFilterValue(value));
    const restoreTriggerFocus = () => window.setTimeout(() => triggerRef.current?.focus(), 0);

    useEffect(() => {
        if (!open || display === "dialog") return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", close);
        return () => document.removeEventListener("keydown", close);
    }, [open, display]);

    useEffect(() => {
        if (previousDatabase.current === database) return;
        previousDatabase.current = database;
        clearFilters();
        setAppliedValues({});
        setError("");
        setOpen(false);
    }, [database, clearFilters, setAppliedValues]);

    const toggle = () => {
        if (open) {
            if (display === "dialog") replaceFilters(appliedValues);
            setOpen(false);
            if (display === "dialog") restoreTriggerFocus();
            return;
        }
        replaceFilters(appliedValues);
        setOpen(true);
        if (!open) {
            window.requestAnimationFrame(() => {
                panelRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
            });
        }
    };

    const cancel = () => {
        replaceFilters(appliedValues);
        setError("");
        setOpen(false);
        restoreTriggerFocus();
    };

    const apply = () => {
        const valueErrors = getFilterValueErrors(definitions, filters);
        if (valueErrors.length > 0) {
            setError(valueErrors.join(" "));
            return;
        }
        setError("");
        setAppliedValues({ ...filters });
        setOpen(false);
        if (display === "dialog") restoreTriggerFocus();
    };

    const reset = () => {
        clearFilters();
        setAppliedValues({});
        setError("");
        setOpen(false);
        if (display === "dialog") restoreTriggerFocus();
    };

    const button = visibleFilters.length > 0 ? (
        <button
            ref={triggerRef}
            type="button"
            className={`app-button widget-filter-button${active ? " widget-filter-button--active" : ""}`}
            aria-label={`Filter ${widgetTitle}`}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={toggle}
        >
            <Filter aria-hidden="true" />
            Filter{active ? " •" : ""}
        </button>
    ) : null;

    const filterForm = (
        <div ref={panelRef} id={panelId} className="widget-filter-panel" aria-label={`${widgetTitle} filters`}>
            <FilterRenderer filters={definitions} database={database} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="widget-filter-panel__actions">
                <button type="button" className="app-button app-button--primary" onClick={apply}>Apply</button>
                <button type="button" className="app-button" onClick={reset}>Reset</button>
                {display === "dialog" && <button type="button" className="app-button" onClick={cancel}>Cancel</button>}
            </div>
        </div>
    );
    const panel = visibleFilters.length > 0 && open
        ? display === "dialog"
            ? createPortal(
                <AccessibleDialog title={`Filter ${widgetTitle}`} onClose={cancel} className="widget-filter-dialog">
                    {filterForm}
                </AccessibleDialog>,
                document.body
            )
            : filterForm
        : null;

    return children({ appliedValues, button, panel });
}
