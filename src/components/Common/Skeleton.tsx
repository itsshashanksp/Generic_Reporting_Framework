type SkeletonKind = "text" | "stat" | "chart" | "table" | "filter";

interface SkeletonProps {
    kind?: SkeletonKind;
    label?: string;
    chartType?: "bar" | "line" | "pie";
    columns?: number;
    rows?: number;
    className?: string;
}

export default function Skeleton({
    kind = "text",
    label = "Loading…",
    chartType = "bar",
    columns = 4,
    rows = 5,
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
                {kind === "table" && <TablePlaceholder columns={columns} rows={rows} />}
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

function TablePlaceholder({ columns, rows }: { columns: number; rows: number }) {
    const safeColumns = Math.min(Math.max(columns, 1), 8);
    const safeRows = Math.min(Math.max(rows, 1), 10);
    return (
        <div className="skeleton__table" style={{ "--skeleton-columns": safeColumns } as CSSProperties}>
            <div className="skeleton__table-row skeleton__table-row--header">
                {Array.from({ length: safeColumns }, (_, index) => <span key={index} className="skeleton__shape" />)}
            </div>
            {Array.from({ length: safeRows }, (_, row) => (
                <div className="skeleton__table-row" key={row}>
                    {Array.from({ length: safeColumns }, (_, column) => <span key={column} className="skeleton__shape" />)}
                </div>
            ))}
        </div>
    );
}
import type { CSSProperties } from "react";

