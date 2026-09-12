import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import type { FilterDefinition } from "../../types/filter";
import FilterRenderer from "./FilterRenderer";

interface ResponsiveFilterPanelProps {
    filters: FilterDefinition[];
    className: string;
    error?: string;
    disabled?: boolean;
    applyLabel?: string;
    clearLabel?: string;
    onApply: () => boolean | void;
    onClear: () => void;
}

export default function ResponsiveFilterPanel({
    filters,
    className,
    error,
    disabled = false,
    applyLabel = "Search",
    clearLabel = "Clear filters",
    onApply,
    onClear,
}: ResponsiveFilterPanelProps) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const panelRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [open]);

    const openPanel = (focusSearch: boolean) => {
        setOpen(true);
        if (focusSearch) {
            window.requestAnimationFrame(() => {
                panelRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
            });
        }
    };

    const apply = () => {
        if (onApply() !== false) setOpen(false);
    };

    const clear = () => {
        onClear();
        setOpen(false);
    };

    return (
        <>
            <div className="responsive-filter-controls" aria-label="Search and filters">
                <button
                    type="button"
                    className="app-button"
                    aria-label="Open search and filters"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => openPanel(true)}
                >
                    <Search aria-hidden="true" />
                    Search &amp; Filters
                </button>
            </div>

            <section
                ref={panelRef}
                id={panelId}
                className={`${className} responsive-filter-panel`}
                data-open={open}
                aria-labelledby={`${panelId}-title`}
            >
                <div className="responsive-filter-panel__header">
                    <h2 id={`${panelId}-title`}>Filters</h2>
                    <button
                        type="button"
                        className="responsive-filter-panel__close"
                        aria-label="Close filters"
                        onClick={() => setOpen(false)}
                    >
                        <X aria-hidden="true" />
                    </button>
                </div>

                <FilterRenderer filters={filters} />
                {error && <p className="form-error" role="alert">{error}</p>}

                <div className="responsive-filter-panel__actions">
                    <button type="button" className="app-button app-button--primary" onClick={apply} disabled={disabled}>
                        {applyLabel}
                    </button>
                    <button type="button" className="app-button" onClick={clear} disabled={disabled}>
                        {clearLabel}
                    </button>
                </div>
            </section>
        </>
    );
}
