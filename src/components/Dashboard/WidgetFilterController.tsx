import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";

import { FilterProvider, useFilters, type FilterValues } from "../../engine/FilterContext";
import { isEmptyFilterValue, isRequiredFilterIncomplete } from "../../engine/FilterEngine";
import type { FilterDefinition } from "../../types/filter";
import FilterRenderer from "../Filters/FilterRenderer";

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
}: {
    filters: FilterDefinition[];
    database?: string;
    widgetTitle: string;
    children: (controls: WidgetFilterControls) => ReactNode;
}) {
    return (
        <FilterProvider>
            <WidgetFilterControllerContent filters={filters} database={database} widgetTitle={widgetTitle}>
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
}: {
    filters: FilterDefinition[];
    database?: string;
    widgetTitle: string;
    children: (controls: WidgetFilterControls) => ReactNode;
}) {
    const { filters, clearFilters } = useFilters();
    const [appliedValues, setAppliedValues] = useState<FilterValues>({});
    const [open, setOpen] = useState(false);
    const [error, setError] = useState("");
    const panelId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const visibleFilters = definitions.filter(filter => filter.visible !== false);
    const active = Object.values(appliedValues).some(value => !isEmptyFilterValue(value));

    useEffect(() => {
        if (!open) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", close);
        return () => document.removeEventListener("keydown", close);
    }, [open]);

    const toggle = () => {
        setOpen(previous => !previous);
        if (!open) {
            window.requestAnimationFrame(() => {
                panelRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
            });
        }
    };

    const apply = () => {
        const missing = definitions.filter(filter => isRequiredFilterIncomplete(filter, filters[filter.field]));
        if (missing.length > 0) {
            setError(`Complete the required filter${missing.length > 1 ? "s" : ""}: ${missing.map(filter => filter.label).join(", ")}.`);
            return;
        }
        setError("");
        setAppliedValues({ ...filters });
        setOpen(false);
    };

    const reset = () => {
        clearFilters();
        setAppliedValues({});
        setError("");
        setOpen(false);
    };

    const button = visibleFilters.length > 0 ? (
        <button
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

    const panel = visibleFilters.length > 0 && open ? (
        <div ref={panelRef} id={panelId} className="widget-filter-panel" aria-label={`${widgetTitle} filters`}>
            <FilterRenderer filters={definitions} database={database} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="widget-filter-panel__actions">
                <button type="button" className="app-button app-button--primary" onClick={apply}>Apply</button>
                <button type="button" className="app-button" onClick={reset}>Reset</button>
            </div>
        </div>
    ) : null;

    return children({ appliedValues, button, panel });
}
