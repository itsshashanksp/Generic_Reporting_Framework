import type { ReactNode } from "react";
import DashboardWidgetHeader from "../Dashboard/DashboardWidgetHeader";

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
            <DashboardWidgetHeader
                title={title}
                description={description}
                actions={actions}
                variant="table"
            />
            <div className="report-table-frame__body">
                {children}
            </div>
        </section>
    );
}
