import type { ReactNode } from "react";

interface ReportTableFrameProps {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    ariaLabel?: string;
    busy?: boolean;
}

export default function ReportTableFrame({
    title,
    description,
    actions,
    children,
    className = "",
    ariaLabel,
    busy,
}: ReportTableFrameProps) {
    return (
        <section
            className={`report-table-frame${className ? ` ${className}` : ""}`}
            aria-label={ariaLabel}
            aria-busy={busy}
        >
            <header className="report-table-frame__header">
                <div className="report-table-frame__heading">
                    <h2>{title}</h2>
                    {description && <p>{description}</p>}
                </div>
                {actions && <div className="report-table-frame__actions">{actions}</div>}
            </header>
            <div className="report-table-frame__body">
                {children}
            </div>
        </section>
    );
}
