import type { ReactNode } from "react";

import "./DashboardWidgets.css";

interface DashboardWidgetFrameProps {
    title: string;
    description?: string;
    refreshing?: boolean;
    children: ReactNode;
    variant?: "default" | "stat";
}

export default function DashboardWidgetFrame({
    title,
    description,
    refreshing = false,
    children,
    variant = "default",
}: DashboardWidgetFrameProps) {
    return (
        <section className={`dashboard-widget-content dashboard-widget-content--${variant}`}>
            <header className="dashboard-widget-content__header">
                <div>
                    <h2>{title}</h2>
                    {description && <p>{description}</p>}
                </div>
                {refreshing && (
                    <span className="dashboard-widget-content__refreshing" role="status">
                        Refreshing…
                    </span>
                )}
            </header>
            <div className="dashboard-widget-content__body">
                {children}
            </div>
        </section>
    );
}
