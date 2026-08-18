import { useFilters } from "../engine/FilterContext";
import FilterRenderer from "../components/Filters/FilterRenderer";
import { getDashboard } from "../engine/DashboardEngine";

import ReportWidget from "../components/Dashboard/ReportWidget";
import StatWidget from "../components/Dashboard/StatWidget";
import ChartWidget from "../components/Dashboard/ChartWidget";

import { useDashboard } from "../engine/DashboardContext";

import "./Dashboard.css";

export default function Dashboard() {

    const dashboard = getDashboard(
        "customer-dashboard"
    );

    const {
        clearFilters,
    } = useFilters();

    const {
        refreshDashboard,
    } = useDashboard();

    if (!dashboard) {
        return (
            <div>
                <h1>Dashboard Not Found</h1>
            </div>
        );
    }

    return (
        <div
            style={{
                padding: "20px",
            }}
        >

            <h1>
                {dashboard.title}
            </h1>

            {dashboard.description && (
                <p>
                    {dashboard.description}
                </p>
            )}

            {dashboard.filters &&
                dashboard.filters.length > 0 && (
                    <div
                        style={{
                            marginBottom: "20px",
                        }}
                    >
                        <FilterRenderer
                            filters={dashboard.filters}
                        />

                        <div
                           style={{
                               display: "flex",
                               gap: "10px",
                               marginTop: "10px",
                            }}
                        >
                            <button onClick={clearFilters}>
                                Clear Filters
                            </button>

                            <button onClick={refreshDashboard}>
                                Refresh
                            </button>
                        </div>
                    </div>
                )}

            <div
            className="dashboard-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        `repeat(${dashboard.layout?.columns ?? 12}, 1fr)`,
                    gap: "16px",
                }}
            >

                {dashboard.widgets
                    .filter(widget => widget.visible !== false)
                    .map(
                        widget => (

                        <div
                            key={widget.id}
                            style={{
                                gridColumn:
                                    `${(widget.position?.x ?? 0) + 1} / span ${widget.width ?? 12}`,

                                gridRow:
                                   "auto",

                                height:
                                   widget.height
                                   ? `${widget.height}px`
                                   : "auto",

                                border:
                                    "1px solid #ddd",

                                borderRadius: "8px",

                                padding: "16px",
                            }}
                        >

                            {widget.type === "report" &&
                                widget.reportId && (
                                    <ReportWidget
                                        reportId={
                                            widget.reportId
                                        }
                                        title={
                                            widget.title
                                        }
                                    />
                                )}

                            {widget.type === "stat" &&
                                widget.request && (
                                    <StatWidget
                                        title={
                                            widget.title
                                        }
                                        request={
                                            widget.request
                                        }
                                        format={
                                            widget.format
                                        }
                                    />
                                )}

                            {widget.type === "chart" &&
                                widget.request &&
                                widget.xField &&
                                widget.yField && (
                                    <ChartWidget
                                        title={
                                            widget.title
                                        }
                                        request={
                                            widget.request
                                        }
                                        xField={
                                            widget.xField
                                        }
                                        yField={
                                            widget.yField
                                        }
                                        chartType={
                                            widget.chartType
                                        }
                                        showLegend={
                                            widget.showLegend
                                        }
                                        showTooltip={
                                            widget.showTooltip
                                        }
                                        showGrid={
                                            widget.showGrid
                                        }
                                        showLabels={
                                            widget.showLabels
                                        }
                                    />
                                )}

                        </div>

                    )
                )}

            </div>

        </div>
    );
}