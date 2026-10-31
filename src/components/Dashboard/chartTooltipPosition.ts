export interface Point {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Bounds extends Point, Size {}

type Direction = "right" | "left" | "bottom" | "top";

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value));
}

function overlapArea(position: Point, tooltip: Size, bounds: Bounds) {
    const width = Math.max(0, Math.min(position.x + tooltip.width, bounds.x + bounds.width) - Math.max(position.x, bounds.x));
    const height = Math.max(0, Math.min(position.y + tooltip.height, bounds.y + bounds.height) - Math.max(position.y, bounds.y));
    return width * height;
}

function clampPosition(position: Point, tooltip: Size, bounds: Bounds, padding: number) {
    const minimumX = bounds.x + padding;
    const minimumY = bounds.y + padding;
    const maximumX = Math.max(minimumX, bounds.x + bounds.width - tooltip.width - padding);
    const maximumY = Math.max(minimumY, bounds.y + bounds.height - tooltip.height - padding);
    return {
        x: clamp(position.x, minimumX, maximumX),
        y: clamp(position.y, minimumY, maximumY),
    };
}

function selectPosition(candidates: Point[], tooltip: Size, bounds: Bounds, avoidBounds: Bounds[], padding: number) {
    return candidates.map((candidate, priority) => {
        const position = clampPosition(candidate, tooltip, bounds, padding);
        const overlap = avoidBounds.reduce((total, avoided) => total + overlapArea(position, tooltip, avoided), 0);
        const displacement = Math.abs(position.x - candidate.x) + Math.abs(position.y - candidate.y);
        return {
            position,
            score: (overlap > 0 ? 1_000_000_000 : 0) + overlap * 1_000 + displacement * 100 + priority,
        };
    }).sort((first, second) => first.score - second.score)[0].position;
}

export function clampChartTooltipPosition(anchor: Point, tooltip: Size, bounds: Bounds, gap = 12, padding = 8) {
    const minimumX = bounds.x + padding;
    const minimumY = bounds.y + padding;
    const maximumX = Math.max(minimumX, bounds.x + bounds.width - tooltip.width - padding);
    const maximumY = Math.max(minimumY, bounds.y + bounds.height - tooltip.height - padding);
    const preferredX = anchor.x + gap + tooltip.width <= bounds.x + bounds.width - padding
        ? anchor.x + gap
        : anchor.x - tooltip.width - gap;
    const preferredY = anchor.y + gap + tooltip.height <= bounds.y + bounds.height - padding
        ? anchor.y + gap
        : anchor.y - tooltip.height - gap;

    return {
        x: clamp(preferredX, minimumX, maximumX),
        y: clamp(preferredY, minimumY, maximumY),
    };
}

/** Places ordinary chart tooltips near the pointer while avoiding known overlays. */
export function placeChartTooltip(
    anchor: Point,
    tooltip: Size,
    bounds: Bounds,
    avoidBounds: Bounds[] = [],
    gap = 12,
    padding = 8,
) {
    return selectPosition([
        { x: anchor.x + gap, y: anchor.y - tooltip.height - gap },
        { x: anchor.x + gap, y: anchor.y + gap },
        { x: anchor.x - tooltip.width - gap, y: anchor.y - tooltip.height - gap },
        { x: anchor.x - tooltip.width - gap, y: anchor.y + gap },
        { x: anchor.x - tooltip.width / 2, y: anchor.y - tooltip.height - gap },
        { x: anchor.x - tooltip.width / 2, y: anchor.y + gap },
    ], tooltip, bounds, avoidBounds, padding);
}

/**
 * Places proportional-chart tooltips beyond the chart's occupied radial area.
 * The candidate nearest the hovered sector is preferred, then alternatives are
 * tried in pointer-relative order before the result is clamped to the viewport.
 */
export function placeRadialChartTooltip(
    anchor: Point,
    tooltip: Size,
    bounds: Bounds,
    radialBounds: Bounds,
    avoidBounds: Bounds[] = [],
    gap = 12,
    padding = 8,
) {
    const center = {
        x: radialBounds.x + radialBounds.width / 2,
        y: radialBounds.y + radialBounds.height / 2,
    };
    const horizontal = anchor.x >= center.x ? "right" : "left";
    const vertical = anchor.y >= center.y ? "bottom" : "top";
    const horizontalFirst = Math.abs(anchor.x - center.x) / Math.max(1, radialBounds.width)
        >= Math.abs(anchor.y - center.y) / Math.max(1, radialBounds.height);
    const directions: Direction[] = horizontalFirst
        ? [horizontal, vertical, vertical === "bottom" ? "top" : "bottom", horizontal === "right" ? "left" : "right"]
        : [vertical, horizontal, horizontal === "right" ? "left" : "right", vertical === "bottom" ? "top" : "bottom"];

    const candidates = directions.map(direction => direction === "right"
            ? { x: radialBounds.x + radialBounds.width + gap, y: anchor.y - tooltip.height / 2 }
            : direction === "left"
                ? { x: radialBounds.x - tooltip.width - gap, y: anchor.y - tooltip.height / 2 }
                : direction === "bottom"
                    ? { x: anchor.x - tooltip.width / 2, y: radialBounds.y + radialBounds.height + gap }
                    : { x: anchor.x - tooltip.width / 2, y: radialBounds.y - tooltip.height - gap });

    return selectPosition(candidates, tooltip, bounds, avoidBounds, padding);
}
