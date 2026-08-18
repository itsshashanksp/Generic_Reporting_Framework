import { useParams } from "react-router-dom";

import { getDashboard } from "../engine/DashboardEngine";

export default function DashboardViewer() {

    const { dashboardId } = useParams();

    const dashboard = getDashboard(
        dashboardId || ""
    );

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

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(12, 1fr)",
                    gap: "16px",
                }}
            >

                {dashboard.widgets.map(
                    widget => (

                        <div
                            key={widget.id}
                            style={{
                                gridColumn:
                                    `span ${widget.width ?? 12}`,

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

                            <h2>
                                {widget.title}
                            </h2>

                            <p>
                                Widget type:{" "}
                                {widget.type}
                            </p>

                        </div>

                    )
                )}

            </div>

        </div>
    );
}