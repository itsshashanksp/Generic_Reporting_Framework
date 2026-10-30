import { useLayoutEffect, type RefObject } from "react";

export interface DashboardHeaderMeasurement {
    element: HTMLElement;
    rowTop: number;
    naturalHeight: number;
    marginBottom: number;
}

export interface DashboardTableMeasurement {
    element: HTMLElement;
    rowTop: number;
    naturalHeight: number;
    alignmentKey?: string;
}

export type DashboardFooterMeasurement = DashboardTableMeasurement;

export function resolveDashboardRowHeaderHeights(
    measurements: DashboardHeaderMeasurement[],
    rowTolerance = 1,
) {
    const rows: DashboardHeaderMeasurement[][] = [];

    for (const measurement of [...measurements].sort((left, right) => left.rowTop - right.rowTop)) {
        const row = rows.find(candidate => Math.abs(candidate[0].rowTop - measurement.rowTop) <= rowTolerance);
        if (row) row.push(measurement);
        else rows.push([measurement]);
    }

    return new Map(rows.flatMap(row => {
        const sharedFootprint = Math.max(...row.map(item => item.naturalHeight + item.marginBottom));
        return row.map(item => [item.element, Math.max(0, sharedFootprint - item.marginBottom)] as const);
    }));
}

export function resolveDashboardRowTableHeights(
    measurements: DashboardTableMeasurement[],
    rowTolerance = 1,
) {
    const rows: DashboardTableMeasurement[][] = [];

    for (const measurement of [...measurements].sort((left, right) => left.rowTop - right.rowTop)) {
        const row = rows.find(candidate =>
            Math.abs(candidate[0].rowTop - measurement.rowTop) <= rowTolerance
        );
        if (row) row.push(measurement);
        else rows.push([measurement]);
    }

    return new Map(rows.flatMap(row => {
        const sharedHeight = Math.max(...row.map(item => item.naturalHeight));
        return row.map(item => [item.element, sharedHeight] as const);
    }));
}

export const resolveDashboardRowFooterHeights = resolveDashboardRowTableHeights;

export function resolveDashboardRowRegionHeights(
    measurements: DashboardTableMeasurement[],
    rowTolerance = 1,
) {
    return resolveDashboardRowTableHeights(
        measurements.map(measurement => ({
            element: measurement.element,
            rowTop: measurement.rowTop,
            naturalHeight: measurement.naturalHeight,
        })),
        rowTolerance,
    );
}

function pixels(value: string) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function measureHeader(header: HTMLElement): DashboardHeaderMeasurement | null {
    const card = header.closest<HTMLElement>("[data-dashboard-widget]");
    const heading = header.querySelector<HTMLElement>(".dashboard-widget-header__heading");
    const actions = header.querySelector<HTMLElement>(".dashboard-widget-header__actions");
    if (!card || !heading) return null;

    const style = window.getComputedStyle(header);
    const contentHeight = Math.max(
        heading.getBoundingClientRect().height,
        actions?.getBoundingClientRect().height ?? 0,
    );
    const chromeHeight = pixels(style.paddingTop)
        + pixels(style.paddingBottom)
        + pixels(style.borderTopWidth)
        + pixels(style.borderBottomWidth);
    const baseHeight = pixels(style.getPropertyValue("--dashboard-widget-header-base-height"));

    return {
        element: header,
        rowTop: card.getBoundingClientRect().top,
        naturalHeight: Math.max(baseHeight, contentHeight + chromeHeight),
        marginBottom: pixels(style.marginBottom),
    };
}

function measureTable(grid: HTMLElement): DashboardTableMeasurement | null {
    const card = grid.closest<HTMLElement>("[data-dashboard-widget]");
    const viewport = grid.classList.contains("universal-grid--reporting")
        ? grid.querySelector<HTMLElement>(".reporting-grid__scroll")
        : grid.querySelector<HTMLElement>(":scope > .ag-theme-alpine");
    if (!card || !viewport || window.getComputedStyle(viewport).display === "none") return null;

    return {
        element: grid,
        rowTop: card.getBoundingClientRect().top,
        naturalHeight: viewport.getBoundingClientRect().height,
        alignmentKey: grid.dataset.gridSizing ?? "bounded",
    };
}

function measureTableRegion(grid: HTMLElement): DashboardTableMeasurement | null {
    const card = grid.closest<HTMLElement>("[data-dashboard-widget]");
    if (!card || window.getComputedStyle(grid).display === "none") return null;

    return {
        element: grid,
        rowTop: card.getBoundingClientRect().top,
        naturalHeight: grid.getBoundingClientRect().height,
    };
}

function measureFooter(grid: HTMLElement): DashboardFooterMeasurement | null {
    const card = grid.closest<HTMLElement>("[data-dashboard-widget]");
    const footer = grid.querySelector<HTMLElement>(":scope > .universal-grid__pagination");
    if (!card || !footer || window.getComputedStyle(footer).display === "none") return null;

    return {
        element: grid,
        rowTop: card.getBoundingClientRect().top,
        naturalHeight: footer.getBoundingClientRect().height,
    };
}

export default function useDashboardRowHeaderAlignment(
    gridRef: RefObject<HTMLDivElement | null>,
    layoutKey: string,
) {
    useLayoutEffect(() => {
        const grid = gridRef.current;
        if (!grid || typeof ResizeObserver === "undefined") return;

        let animationFrame = 0;
        const align = () => {
            animationFrame = 0;
            const headers = [...grid.querySelectorAll<HTMLElement>(".dashboard-widget-header")];
            const tables = [...grid.querySelectorAll<HTMLElement>(".universal-grid")];
            for (const table of tables) {
                table.style.removeProperty("--dashboard-row-table-viewport-height");
                table.style.removeProperty("--dashboard-row-table-footer-height");
                table.style.removeProperty("--dashboard-row-table-region-height");
            }

            const measurements = headers.map(measureHeader).filter((value): value is DashboardHeaderMeasurement => value !== null);
            const heights = resolveDashboardRowHeaderHeights(measurements);
            const tableMeasurements = tables.map(measureTable).filter((value): value is DashboardTableMeasurement => value !== null);
            const tableHeights = resolveDashboardRowTableHeights(tableMeasurements);
            const footerMeasurements = tables.map(measureFooter).filter((value): value is DashboardFooterMeasurement => value !== null);
            const footerHeights = resolveDashboardRowFooterHeights(footerMeasurements);
            const regionMeasurements = tables.map(measureTableRegion).filter((value): value is DashboardTableMeasurement => value !== null);
            const regionHeights = resolveDashboardRowRegionHeights(regionMeasurements);

            for (const header of headers) {
                const height = heights.get(header);
                if (height !== undefined) {
                    const nextValue = `${Math.ceil(height)}px`;
                    if (header.style.getPropertyValue("--dashboard-row-header-height") !== nextValue) {
                        header.style.setProperty("--dashboard-row-header-height", nextValue);
                    }
                } else {
                    header.style.removeProperty("--dashboard-row-header-height");
                }
            }
            for (const table of tables) {
                const card = table.closest<HTMLElement>("[data-dashboard-widget]");
                const height = tableHeights.get(table);
                if (height !== undefined && card?.dataset.fixedHeight !== "true") {
                    const nextValue = `${Math.ceil(height)}px`;
                    table.style.setProperty("--dashboard-row-table-viewport-height", nextValue);
                }
                const footerHeight = footerHeights.get(table);
                if (footerHeight !== undefined && card?.dataset.fixedHeight !== "true") {
                    table.style.setProperty("--dashboard-row-table-footer-height", `${Math.ceil(footerHeight)}px`);
                }
                const regionHeight = regionHeights.get(table);
                if (regionHeight !== undefined && card?.dataset.fixedHeight !== "true") {
                    table.style.setProperty("--dashboard-row-table-region-height", `${Math.ceil(regionHeight)}px`);
                }
            }
        };
        const scheduleAlignment = () => {
            if (!animationFrame) animationFrame = window.requestAnimationFrame(align);
        };
        const observer = new ResizeObserver(scheduleAlignment);
        observer.observe(grid);
        for (const element of grid.querySelectorAll<HTMLElement>(
            ".dashboard-widget-header__heading, .dashboard-widget-header__actions, .universal-grid, .ag-theme-alpine, .ag-root-wrapper, .ag-root-wrapper-body, .reporting-grid__scroll, .reporting-grid, .reporting-grid tbody, .universal-grid__pagination",
        )) observer.observe(element);
        scheduleAlignment();

        return () => {
            observer.disconnect();
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
            for (const header of grid.querySelectorAll<HTMLElement>(".dashboard-widget-header")) {
                header.style.removeProperty("--dashboard-row-header-height");
            }
            for (const table of grid.querySelectorAll<HTMLElement>(".universal-grid")) {
                table.style.removeProperty("--dashboard-row-table-viewport-height");
                table.style.removeProperty("--dashboard-row-table-footer-height");
                table.style.removeProperty("--dashboard-row-table-region-height");
            }
        };
    }, [gridRef, layoutKey]);
}
