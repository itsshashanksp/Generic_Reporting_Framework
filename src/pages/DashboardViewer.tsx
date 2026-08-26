import { useParams } from "react-router-dom";

import Dashboard from "./Dashboard";

export default function DashboardViewer() {

    const { dashboardId } = useParams();

    return (
        <Dashboard
            dashboardId={dashboardId || ""}
        />
    );
}
