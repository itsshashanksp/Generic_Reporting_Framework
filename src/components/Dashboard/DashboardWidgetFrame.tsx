import type { ReactNode } from "react";


interface DashboardWidgetFrameProps {
    title: string;
    description?: string;
    refreshing?: boolean;
    busy?: boolean;
    children: ReactNode;
    variant?: "default" | "stat";
    actions?: ReactNode;
    filterPanel?: ReactNode;
}

export default function DashboardWidgetFrame({
    title,
    description,
    refreshing = false,
    busy = false,
    children,
    variant = "default",
    actions,
    filterPanel,
}: DashboardWidgetFrameProps) {
    return (
        <section className={`dashboard-widget-content dashboard-widget-content--${variant}`} aria-busy={busy}>
            <header className="dashboard-widget-content__header">
                <div>
                    <h2>{title}</h2>
                    {description && <p>{description}</p>}
                </div>
                <div className="dashboard-widget-content__actions">
                    {refreshing && (
                        <span className="dashboard-widget-content__refreshing" role="status">Refreshing…</span>
                    )}
                    {actions}
                </div>
            </header>
            {filterPanel}
            <div className="dashboard-widget-content__body">
                {children}
            </div>
        </section>
    );
}
