import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface ActionMenuItem {
    id: string;
    label: string;
    onSelect: () => void;
    disabled?: boolean;
    destructive?: boolean;
}

export default function ActionMenu({ label, items, disabled = false }: {
    label: string;
    items: ActionMenuItem[];
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
    const menuId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const close = (restoreFocus = false) => {
        setOpen(false);
        if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
    };

    useLayoutEffect(() => {
        if (!open || !triggerRef.current || !menuRef.current) return;
        const trigger = triggerRef.current.getBoundingClientRect();
        const menu = menuRef.current.getBoundingClientRect();
        const gap = 6;
        const viewportPadding = 8;
        const left = Math.max(viewportPadding, Math.min(trigger.right - menu.width, window.innerWidth - menu.width - viewportPadding));
        const fitsBelow = trigger.bottom + gap + menu.height <= window.innerHeight - viewportPadding;
        const top = fitsBelow
            ? trigger.bottom + gap
            : Math.max(viewportPadding, trigger.top - menu.height - gap);
        setPosition({ top, left, visibility: "visible" });
        itemRefs.current.find(item => item && !item.disabled)?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
        };
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === "Escape") close(true);
        };
        const onViewportChange = () => close();
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onViewportChange);
        window.addEventListener("scroll", onViewportChange, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onViewportChange);
            window.removeEventListener("scroll", onViewportChange, true);
        };
    }, [open]);

    const enabledItems = () => itemRefs.current.filter(
        (item): item is HTMLButtonElement => Boolean(item && !item.disabled)
    );
    const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const enabled = enabledItems();
        const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | null = null;
        if (event.key === "ArrowDown") next = current + 1;
        if (event.key === "ArrowUp") next = current - 1;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = enabled.length - 1;
        if (next === null || !enabled.length) return;
        event.preventDefault();
        enabled[(next + enabled.length) % enabled.length].focus();
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className="app-button action-menu__trigger"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                disabled={disabled}
                onClick={() => setOpen(previous => !previous)}
            >
                Actions <span aria-hidden="true">▾</span>
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    id={menuId}
                    className="action-menu__items"
                    role="menu"
                    aria-label={label}
                    style={position}
                    onKeyDown={handleMenuKeyDown}
                >
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            ref={element => { itemRefs.current[index] = element; }}
                            type="button"
                            role="menuitem"
                            className={item.destructive ? "action-menu__item--danger" : undefined}
                            disabled={item.disabled}
                            onClick={() => {
                                close(true);
                                item.onSelect();
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
