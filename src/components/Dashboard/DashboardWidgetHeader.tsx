import type { ReactNode } from "react";

interface DashboardWidgetHeaderProps {
    title: string;
    description?: string;
    actions?: ReactNode;
    variant?: "content" | "table";
}

export default function DashboardWidgetHeader({
    title,
    description,
    actions,
    variant = "content",
}: DashboardWidgetHeaderProps) {
    const headerClass = variant === "table"
        ? "dashboard-widget-header report-table-frame__header"
        : "dashboard-widget-header dashboard-widget-content__header";
    const headingClass = variant === "table"
        ? "dashboard-widget-header__heading report-table-frame__heading"
        : "dashboard-widget-header__heading";
    const actionsClass = variant === "table"
        ? "dashboard-widget-header__actions report-table-frame__actions"
        : "dashboard-widget-header__actions dashboard-widget-content__actions";

    return (
        <header className={headerClass}>
            <div className={headingClass}>
                <h2 title={title}>{title}</h2>
                {description && <p>{description}</p>}
            </div>
            {actions && <div className={actionsClass}>{actions}</div>}
        </header>
    );
}
