import type { PaginationConfig } from "../../types/report";
import { getPageTokens } from "./paginationTokens";

interface PaginationProps {
    page: number;
    pageSize: number;
    pageSizeOptions?: number[];
    totalRows?: number | null;
    rowsOnPage: number;
    disabled?: boolean;
    config: Pick<PaginationConfig, "showTotalRecords" | "showPageNumbers" | "showFirstLast">;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    className?: string;
}

export default function Pagination({
    page,
    pageSize,
    pageSizeOptions = [],
    totalRows,
    rowsOnPage,
    disabled = false,
    config,
    onPageChange,
    onPageSizeChange,
    className = "",
}: PaginationProps) {
    const hasKnownTotal = typeof totalRows === "number" && Number.isFinite(totalRows) && totalRows >= 0;
    const totalPages = hasKnownTotal ? Math.max(1, Math.ceil(totalRows / pageSize)) : null;
    const safePage = totalPages === null ? Math.max(1, page) : Math.min(Math.max(1, page), totalPages);
    const rangeStart = rowsOnPage > 0 ? (safePage - 1) * pageSize + 1 : 0;
    const rangeEnd = rowsOnPage > 0 ? rangeStart + rowsOnPage - 1 : 0;
    const canGoNext = totalPages === null ? rowsOnPage >= pageSize : safePage < totalPages;
    const options = [...new Set([...pageSizeOptions, pageSize])]
        .filter(option => Number.isInteger(option) && option > 0)
        .sort((left, right) => left - right);
    const tokens = config.showPageNumbers !== false && totalPages !== null
        ? getPageTokens(safePage, totalPages)
        : [];

    return (
        <footer className={`universal-grid__pagination${className ? ` ${className}` : ""}`} aria-label="Grid pagination">
            {config.showTotalRecords !== false && (
                <span className="universal-grid__range">
                    {hasKnownTotal
                        ? `Showing ${rangeStart}–${rangeEnd} of ${(totalRows as number).toLocaleString()}`
                        : `Showing ${rangeStart}–${rangeEnd}`}
                </span>
            )}
            <label className="universal-grid__page-size">
                <span>Rows per page</span>
                <select
                    aria-label="Rows per page"
                    value={pageSize}
                    disabled={disabled}
                    onChange={event => onPageSizeChange(Number(event.target.value))}
                >
                    {options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
            </label>
            <nav className="universal-grid__page-buttons" aria-label="Page navigation">
                {config.showFirstLast === true && (
                    <button type="button" aria-label="First page" disabled={disabled || safePage <= 1} onClick={() => onPageChange(1)}>First</button>
                )}
                <button type="button" aria-label="Previous page" disabled={disabled || safePage <= 1} onClick={() => onPageChange(safePage - 1)}>Previous</button>
                {tokens.map(token => typeof token === "number" ? (
                    <button
                        key={token}
                        type="button"
                        className="universal-grid__page-number"
                        aria-label={`Page ${token}`}
                        aria-current={token === safePage ? "page" : undefined}
                        disabled={disabled || token === safePage}
                        onClick={() => onPageChange(token)}
                    >
                        {token}
                    </button>
                ) : <span key={token} className="universal-grid__ellipsis" aria-hidden="true">…</span>)}
                <button type="button" aria-label="Next page" disabled={disabled || !canGoNext} onClick={() => onPageChange(safePage + 1)}>Next</button>
                {config.showFirstLast === true && totalPages !== null && (
                    <button type="button" aria-label="Last page" disabled={disabled || safePage >= totalPages} onClick={() => onPageChange(totalPages)}>Last</button>
                )}
            </nav>
        </footer>
    );
}
