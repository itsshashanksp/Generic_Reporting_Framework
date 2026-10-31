import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { placeChartTooltip, placeRadialChartTooltip, type Bounds } from "./chartTooltipPosition";

interface Point { x: number; y: number }

interface TooltipEntry {
    color?: string;
    name?: unknown;
    value?: unknown;
    payload?: { name?: unknown };
}

function getRenderedRadialBounds(canvas: HTMLElement, fallback: Bounds): Bounds {
    const sectorBounds = Array.from(canvas.querySelectorAll<SVGElement>(".recharts-pie-sector path"))
        .map(sector => sector.getBoundingClientRect())
        .filter(bounds => bounds.width > 0 && bounds.height > 0);
    if (!sectorBounds.length) return fallback;

    const left = Math.min(...sectorBounds.map(bounds => bounds.left));
    const top = Math.min(...sectorBounds.map(bounds => bounds.top));
    const right = Math.max(...sectorBounds.map(bounds => bounds.right));
    const bottom = Math.max(...sectorBounds.map(bounds => bounds.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
}

function getBrowserViewportBounds(): Bounds {
    const viewport = window.visualViewport;
    return {
        x: viewport?.offsetLeft ?? 0,
        y: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
    };
}

function getLegendBounds(canvas: HTMLElement): Bounds[] {
    const legend = canvas.querySelector<HTMLElement>(".recharts-legend-wrapper");
    if (!legend) return [];
    const bounds = legend.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0
        ? [{ x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }]
        : [];
}

export interface ChartTooltipContentProps {
    active?: boolean;
    coordinate?: Partial<Point>;
    label?: unknown;
    payload?: readonly TooltipEntry[];
}

export default function ChartTooltip({
    active,
    coordinate,
    label,
    payload,
    viewport,
    canvas,
    formatValue,
    formatPercentage,
    placement = "cursor",
    radialCenterYRatio = 0.5,
    radialOuterRadiusRatio = 0.4,
}: ChartTooltipContentProps & {
    viewport: HTMLElement | null;
    canvas: HTMLElement | null;
    formatValue: (value: unknown) => string;
    formatPercentage?: (value: unknown) => string | null;
    placement?: "cursor" | "radial";
    radialCenterYRatio?: number;
    radialOuterRadiusRatio?: number;
}) {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<(Point & { maxWidth: number }) | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const entries = payload ?? [];
    const hasCoordinate = coordinate !== undefined;
    const coordinateX = Number(coordinate?.x ?? 0);
    const coordinateY = Number(coordinate?.y ?? 0);
    const contentKey = `${String(label ?? "")}:${entries.map(entry => `${String(entry.name ?? "")}:${formatValue(entry.value)}:${formatPercentage?.(entry.value) ?? ""}`).join("|")}`;

    useEffect(() => {
        if (!active || !canvas) return;
        const dismissOutsideChart = (event: PointerEvent) => {
            if (!(event.target instanceof Node)) return;
            setDismissed(!canvas.contains(event.target));
        };
        const restoreInsideChart = () => setDismissed(false);
        document.addEventListener("pointerdown", dismissOutsideChart);
        canvas.addEventListener("pointerenter", restoreInsideChart);
        return () => {
            document.removeEventListener("pointerdown", dismissOutsideChart);
            canvas.removeEventListener("pointerenter", restoreInsideChart);
        };
    }, [active, canvas]);

    useLayoutEffect(() => {
        if (!active || dismissed || !viewport || !canvas || !tooltipRef.current || !hasCoordinate) {
            setPosition(null);
            return;
        }

        const update = () => {
            if (!tooltipRef.current) return;
            const canvasBounds = canvas.getBoundingClientRect();
            const tooltipBounds = tooltipRef.current.getBoundingClientRect();
            const browserBounds = getBrowserViewportBounds();
            const constrainedSize = {
                width: Math.min(tooltipBounds.width, Math.max(0, browserBounds.width - 16)),
                height: tooltipBounds.height,
            };
            const anchor = {
                x: canvasBounds.left + coordinateX,
                y: canvasBounds.top + coordinateY,
            };
            const avoidBounds = getLegendBounds(canvas);
            const nextPosition = placement === "radial"
                ? placeRadialChartTooltip(anchor, constrainedSize, browserBounds, (() => {
                    const radius = Math.min(canvasBounds.width, canvasBounds.height) * radialOuterRadiusRatio;
                    return getRenderedRadialBounds(canvas, {
                        x: canvasBounds.left + canvasBounds.width / 2 - radius,
                        y: canvasBounds.top + canvasBounds.height * radialCenterYRatio - radius,
                        width: radius * 2,
                        height: radius * 2,
                    });
                })(), avoidBounds)
                : placeChartTooltip(anchor, constrainedSize, browserBounds, avoidBounds);
            setPosition({ ...nextPosition, maxWidth: constrainedSize.width });
        };

        update();
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
        observer?.observe(viewport);
        observer?.observe(canvas);
        observer?.observe(tooltipRef.current);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        window.visualViewport?.addEventListener("resize", update);
        window.visualViewport?.addEventListener("scroll", update);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
            window.visualViewport?.removeEventListener("resize", update);
            window.visualViewport?.removeEventListener("scroll", update);
        };
    }, [active, canvas, contentKey, coordinateX, coordinateY, dismissed, hasCoordinate, placement, radialCenterYRatio, radialOuterRadiusRatio, viewport]);

    if (!active || dismissed || !entries.length || typeof document === "undefined") return null;
    const heading = String(label ?? entries[0]?.payload?.name ?? entries[0]?.name ?? "");

    return createPortal(
        <div
            ref={tooltipRef}
            className="dashboard-chart-tooltip"
            role="status"
            style={position ? { left: position.x, top: position.y, maxWidth: position.maxWidth } : { visibility: "hidden" }}
        >
            {heading && <div className="dashboard-chart-tooltip__label">{heading}</div>}
            {entries.map((entry, index) => (
                <div key={`${String(entry.name ?? "value")}-${index}`} className="dashboard-chart-tooltip__value">
                    <span aria-hidden="true" style={{ backgroundColor: entry.color ?? "#3274d9" }} />
                    <span className="dashboard-chart-tooltip__content">
                        {!formatPercentage && <span className="dashboard-chart-tooltip__series">{String(entry.name ?? "Value")}</span>}
                        <span className="dashboard-chart-tooltip__amount">{formatValue(entry.value)}</span>
                        {formatPercentage?.(entry.value) && <span className="dashboard-chart-tooltip__percentage">{formatPercentage(entry.value)}</span>}
                    </span>
                </div>
            ))}
        </div>,
        document.body,
    );
}
