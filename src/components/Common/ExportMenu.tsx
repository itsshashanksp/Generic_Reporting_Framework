import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
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
    const [mobile, setMobile] = useState(false);
    const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useLayoutEffect(() => {
        if (!open || mobile || !triggerRef.current || !menuRef.current) return;
        const trigger = triggerRef.current.getBoundingClientRect();
        const menu = menuRef.current.getBoundingClientRect();
        const gap = 6;
        const padding = 8;
        const below = trigger.bottom + gap + menu.height <= window.innerHeight - padding;
        const top = below ? trigger.bottom + gap : Math.max(padding, trigger.top - menu.height - gap);
        const left = Math.max(padding, Math.min(trigger.right - menu.width, window.innerWidth - menu.width - padding));
        setPosition({ position: "fixed", top, left, right: "auto", visibility: "visible" });
        itemRefs.current.find(item => item && !item.disabled)?.focus();
    }, [open, mobile]);

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
        const handleViewportChange = () => setOpen(false);

        document.addEventListener("pointerdown", handleOutside);
        document.addEventListener("keydown", handleEscape);
        window.addEventListener("resize", handleViewportChange);
        window.addEventListener("scroll", handleViewportChange, true);
        return () => {
            document.removeEventListener("pointerdown", handleOutside);
            document.removeEventListener("keydown", handleEscape);
            window.removeEventListener("resize", handleViewportChange);
            window.removeEventListener("scroll", handleViewportChange, true);
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
            <div ref={menuRef} className="export-menu__items" data-placement={mobile ? "sheet" : "viewport"} role="menu" aria-label={menuLabel} style={mobile ? undefined : position} onKeyDown={handleKeyDown}>
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
                    if (!open) {
                        setMobile(window.matchMedia?.("(max-width: 720px)").matches ?? false);
                        setPosition({ visibility: "hidden" });
                    }
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
            {open && createPortal(menuContent, document.body)}
        </div>
    );
}
