import type { PaginationConfig, ToolbarConfig } from "../../types/report";

export function isSavedReportsEnabled(toolbar: ToolbarConfig): boolean {
    return toolbar.saveReport !== false;
}

export function getReportPaginationParameters(
    pagination: PaginationConfig,
    page: number,
    pageSize: number
) {
    return pagination.enabled
        ? { pagination: { page, pageSize } }
        : {};
}
