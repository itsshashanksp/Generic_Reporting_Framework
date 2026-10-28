import { resolveTableLayout } from "../Grid/tableLayout";

export function getDashboardTableViewportHeight(pageSize: number) {
    return resolveTableLayout(pageSize, { fixedViewport: true }).gridHeight;
}
