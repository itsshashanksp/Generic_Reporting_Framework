import type { CSSProperties } from "react";
import { resolveTableLayout, type ResolvedTableLayout } from "../Grid/tableLayout";

type SkeletonKind = "text" | "stat" | "chart" | "table" | "filter";

interface SkeletonColumn {
    width?: number;
    visible?: boolean;
}

interface SkeletonProps {
    kind?: SkeletonKind;
    label?: string;
    chartType?: "bar" | "line" | "pie";
    columns?: number;
    tableColumns?: SkeletonColumn[];
    rows?: number;
    tableLayout?: ResolvedTableLayout;
    showHeader?: boolean;
    showPagination?: boolean;
    className?: string;
}

export default function Skeleton({
    kind = "text",
    label = "Loading…",
    chartType = "bar",
    columns = 4,
    tableColumns,
    rows = 5,
    tableLayout,
    showHeader = true,
    showPagination = false,
    className = "",
}: SkeletonProps) {
    const classes = `skeleton skeleton--${kind}${className ? ` ${className}` : ""}`;

    return (
        <div className={classes} role="status" aria-live="polite" aria-label={label}>
            <span className="sr-only">{label}</span>
            <div className="skeleton__content" aria-hidden="true">
                {kind === "text" && <span className="skeleton__shape skeleton__text" />}
                {kind === "stat" && <span className="skeleton__shape skeleton__stat-value" />}
                {kind === "filter" && <span className="skeleton__shape skeleton__filter-control" />}
                {kind === "chart" && <ChartPlaceholder type={chartType} />}
                {kind === "table" && <TablePlaceholder columns={columns} tableColumns={tableColumns} rows={rows} layout={tableLayout} showHeader={showHeader} showPagination={showPagination} />}
            </div>
        </div>
    );
}

function ChartPlaceholder({ type }: { type: "bar" | "line" | "pie" }) {
    if (type === "pie") {
        return <div className="skeleton__chart skeleton__chart--pie"><span className="skeleton__shape skeleton__ring" /></div>;
    }
    if (type === "line") {
        return (
            <div className="skeleton__chart skeleton__chart--line">
                <span className="skeleton__shape skeleton__line skeleton__line--one" />
                <span className="skeleton__shape skeleton__line skeleton__line--two" />
                <span className="skeleton__shape skeleton__line skeleton__line--three" />
            </div>
        );
    }
    return (
        <div className="skeleton__chart skeleton__chart--bar">
            {[72, 48, 88, 62, 78].map((width, index) => (
                <span key={index} className="skeleton__shape skeleton__bar" style={{ width: `${width}%` }} />
            ))}
        </div>
    );
}

function TablePlaceholder({
    columns,
    tableColumns,
    rows,
    layout,
    showHeader,
    showPagination,
}: {
    columns: number;
    tableColumns?: SkeletonColumn[];
    rows: number;
    layout?: ResolvedTableLayout;
    showHeader: boolean;
    showPagination: boolean;
}) {
    const configuredColumns = tableColumns?.filter(column => column.visible !== false).slice(0, 12) ?? [];
    const safeColumns = configuredColumns.length || Math.min(Math.max(columns, 1), 8);
    const resolvedLayout = layout ?? resolveTableLayout(rows, { pagination: showPagination });
    const safeRows = resolvedLayout.visibleRows;
    const template = configuredColumns.length
        ? configuredColumns.map(column => `${Math.max(column.width ?? 160, 80)}fr`).join(" ")
        : `repeat(${safeColumns}, minmax(0, 1fr))`;
    return (
        <div className="skeleton__table" style={{
            "--skeleton-columns": template,
            "--skeleton-header-height": `${resolvedLayout.headerHeight}px`,
            "--skeleton-row-height": `${resolvedLayout.rowHeight}px`,
            "--skeleton-pagination-height": `${resolvedLayout.paginationHeight}px`,
            minHeight: `${resolvedLayout.totalHeight}px`,
        } as CSSProperties}>
            <div className="skeleton__table-rows">
                {showHeader && (
                    <div className="skeleton__table-row skeleton__table-row--header">
                        {Array.from({ length: safeColumns }, (_, index) => <span key={index} className="skeleton__shape" />)}
                    </div>
                )}
                {Array.from({ length: safeRows }, (_, row) => (
                    <div className="skeleton__table-row" key={row}>
                        {Array.from({ length: safeColumns }, (_, column) => <span key={column} className="skeleton__shape" />)}
                    </div>
                ))}
            </div>
            {showPagination && (
                <div className="skeleton__pagination">
                    <span className="skeleton__shape" />
                    <span className="skeleton__shape" />
                    <div>
                        <span className="skeleton__shape" />
                        <span className="skeleton__shape" />
                    </div>
                </div>
            )}
        </div>
    );
}

