import {
    GRID_BORDER_HEIGHT,
    GRID_HEADER_HEIGHT,
    GRID_ROW_HEIGHT,
    resolveTableLayout,
} from "../Grid/tableLayout";

export function getDashboardTableViewportHeight(pageSize: number) {
    return resolveTableLayout(pageSize, { fixedViewport: true }).gridHeight;
}

export function getDashboardTableContentHeight(rowCount: number, pageSize: number) {
    const capacity = resolveTableLayout(pageSize, { fixedViewport: true }).visibleRows;
    const visibleRows = Math.min(Math.max(0, rowCount), capacity);
    return GRID_HEADER_HEIGHT + visibleRows * GRID_ROW_HEIGHT + GRID_BORDER_HEIGHT;
}
