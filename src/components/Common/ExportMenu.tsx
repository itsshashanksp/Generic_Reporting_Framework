import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";


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
    triggerLabel?: string;
    busyLabel?: string;
    menuLabel?: string;
    mobileTriggerLabel?: string;
}

export default function ExportMenu({
    options,
    disabled = false,
    busy = false,
    triggerLabel = "Export",
    busyLabel = "Exporting…",
    menuLabel = "Export options",
    mobileTriggerLabel,
}: ExportMenuProps) {
    const [open, setOpen] = useState(false);
    const [useMobilePortal, setUseMobilePortal] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => {
        if (!open) return;

        const handleOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                !containerRef.current?.contains(target)
                && !menuRef.current?.contains(target)
            ) setOpen(false);
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

    const menuContent = (
        <>
            <button
                type="button"
                className="export-menu__backdrop"
                aria-label={`Close ${menuLabel.toLowerCase()}`}
                onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                }}
            />
            <div ref={menuRef} className="export-menu__items" role="menu" aria-label={menuLabel} onKeyDown={handleKeyDown}>
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
                <button
                    type="button"
                    role="menuitem"
                    className="export-menu__cancel"
                    onClick={() => {
                        setOpen(false);
                        triggerRef.current?.focus();
                    }}
                >
                    Cancel
                </button>
            </div>
        </>
    );

    return (
        <div className="export-menu" ref={containerRef}>
            <button
                ref={triggerRef}
                type="button"
                className="app-button"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled || busy}
                onClick={() => {
                    if (!open) setUseMobilePortal(window.matchMedia?.("(max-width: 720px)").matches ?? false);
                    setOpen(previous => !previous);
                }}
            >
                {busy ? busyLabel : (
                    <>
                        <span className="export-menu__trigger-label export-menu__trigger-label--desktop">{triggerLabel}</span>
                        <span className="export-menu__trigger-label export-menu__trigger-label--mobile" aria-hidden="true">{mobileTriggerLabel ?? triggerLabel}</span>
                    </>
                )}<span aria-hidden="true"> ▾</span>
            </button>
            {open && (useMobilePortal
                ? createPortal(menuContent, document.body)
                : menuContent)}
        </div>
    );
}
