import type { ReactNode } from "react";
import DashboardWidgetHeader from "./DashboardWidgetHeader";

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
            <DashboardWidgetHeader
                title={title}
                description={description}
                actions={(
                    <>
                    <span
                        className="dashboard-widget-content__refreshing"
                        role={refreshing ? "status" : undefined}
                        aria-hidden={refreshing ? undefined : true}
                    >{refreshing ? "Refreshing…" : ""}</span>
                    {actions}
                    </>
                )}
            />
            {filterPanel}
            <div className="dashboard-widget-content__body">
                {children}
            </div>
        </section>
    );
}
