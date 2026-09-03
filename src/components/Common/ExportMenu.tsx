import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import "./ExportMenu.css";

export interface ExportMenuOption {
    id: string;
    label: string;
    onSelect: () => void;
    disabled?: boolean;
}

interface ExportMenuProps {
    options: ExportMenuOption[];
    disabled?: boolean;
    busy?: boolean;
}

export default function ExportMenu({ options, disabled = false, busy = false }: ExportMenuProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        if (!open) return;

        const handleOutside = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handleOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("pointerdown", handleOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    const enabledItems = () => itemRefs.current.filter(
        (item): item is HTMLButtonElement => Boolean(item && !item.disabled)
    );

    const focusItem = (index: number) => {
        const items = enabledItems();
        if (items.length) items[(index + items.length) % items.length].focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const items = enabledItems();
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusItem(current + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            focusItem(current - 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            focusItem(0);
        } else if (event.key === "End") {
            event.preventDefault();
            focusItem(items.length - 1);
        }
    };

    if (!options.length) return null;

    return (
        <div className="export-menu" ref={containerRef}>
            <button
                ref={triggerRef}
                type="button"
                className="app-button"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled || busy}
                onClick={() => setOpen(previous => !previous)}
            >
                {busy ? "Exporting…" : "Export"}<span aria-hidden="true"> ▾</span>
            </button>
            {open && (
                <div className="export-menu__items" role="menu" aria-label="Export options" onKeyDown={handleKeyDown}>
                    {options.map((option, index) => (
                        <button
                            key={option.id}
                            ref={element => { itemRefs.current[index] = element; }}
                            type="button"
                            role="menuitem"
                            disabled={option.disabled}
                            onClick={() => {
                                setOpen(false);
                                option.onSelect();
                                triggerRef.current?.focus();
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
