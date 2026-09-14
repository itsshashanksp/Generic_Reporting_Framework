import { formatNumberForDisplay } from "../ValueFormatter";

const DEFAULT_MIN_WIDTH = 150;
const CELL_HORIZONTAL_SPACE = 25;
const HEADER_HORIZONTAL_SPACE = 53;
const GRID_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FALLBACK_CHARACTER_WIDTH = 8;

type TextMeasurer = (value: string, fontWeight: number) => number;

let canvasContext: CanvasRenderingContext2D | null | undefined;

function getCanvasContext() {
    if (canvasContext !== undefined) {
        return canvasContext;
    }

    if (
        typeof document === "undefined"
        || (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom"))
    ) {
        canvasContext = null;
        return canvasContext;
    }

    canvasContext = document.createElement("canvas").getContext("2d");
    return canvasContext;
}

function measureGridText(value: string, fontWeight: number) {
    const context = getCanvasContext();

    if (!context) {
        return value.length * FALLBACK_CHARACTER_WIDTH;
    }

    context.font = `${fontWeight} 13px ${GRID_FONT_FAMILY}`;
    return context.measureText(value).width;
}

function displayText(value: unknown) {
    if (typeof value === "number") return formatNumberForDisplay(value);
    return value == null ? "" : String(value);
}

/**
 * Returns the content constraint for one column. Flex remains responsible for
 * its final width and for distributing any space left in the grid viewport.
 */
export function getContentMinWidth(
    rows: Record<string, unknown>[],
    field: string,
    header: string,
    sortable: boolean,
    measureText: TextMeasurer = measureGridText,
) {
    const headerWidth = measureText(header, 650)
        + HEADER_HORIZONTAL_SPACE
        - (sortable ? 0 : 28);
    const cellWidth = rows.reduce(
        (longest, row) => Math.max(
            longest,
            measureText(displayText(row[field]), 400) + CELL_HORIZONTAL_SPACE,
        ),
        0,
    );

    return Math.ceil(Math.max(DEFAULT_MIN_WIDTH, headerWidth, cellWidth));
}
