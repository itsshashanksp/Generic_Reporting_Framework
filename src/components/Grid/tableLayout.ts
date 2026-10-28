export const GRID_HEADER_HEIGHT = 44;
export const GRID_ROW_HEIGHT = 42;
export const GRID_BORDER_HEIGHT = 2;
export const GRID_PAGINATION_HEIGHT = 58;
export const MAX_VISIBLE_DASHBOARD_ROWS = 10;

export interface ResolvedTableLayout {
    pageSize: number;
    visibleRows: number;
    headerHeight: number;
    rowHeight: number;
    paginationHeight: number;
    gridHeight: number;
    totalHeight: number;
}

export function resolveTableLayout(
    pageSize: number,
    options: { fixedViewport?: boolean; pagination?: boolean } = {},
): ResolvedTableLayout {
    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    const visibleRows = options.fixedViewport
        ? Math.min(normalizedPageSize, MAX_VISIBLE_DASHBOARD_ROWS)
        : normalizedPageSize;
    const paginationHeight = options.pagination === false ? 0 : GRID_PAGINATION_HEIGHT;
    const gridHeight = GRID_HEADER_HEIGHT + visibleRows * GRID_ROW_HEIGHT + GRID_BORDER_HEIGHT;

    return {
        pageSize: normalizedPageSize,
        visibleRows,
        headerHeight: GRID_HEADER_HEIGHT,
        rowHeight: GRID_ROW_HEIGHT,
        paginationHeight,
        gridHeight,
        totalHeight: gridHeight + paginationHeight,
    };
}
