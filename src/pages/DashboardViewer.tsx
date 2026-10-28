import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Dashboard from "./Dashboard";
import { useAuth } from "../auth";
import { getDashboardChartColors, updateDashboardChartColors, type ChartColorConfiguration } from "../api/chartConfiguration";

export default function DashboardViewer() {

    const { dashboardId } = useParams();
    const { state: authentication } = useAuth();
    const id = dashboardId || "";
    const [chartColors, setChartColors] = useState<Record<string, ChartColorConfiguration>>({});
    const [configurationError, setConfigurationError] = useState("");

    const loadColors = useCallback(async () => {
        if (!id) return [];
        const configurations = await getDashboardChartColors(id);
        setChartColors(Object.fromEntries(configurations.map(configuration => [configuration.widgetId, configuration])));
        setConfigurationError("");
        return configurations;
    }, [id]);

    useEffect(() => {
        let active = true;
        void getDashboardChartColors(id).then(configurations => {
            if (active) setChartColors(Object.fromEntries(configurations.map(configuration => [configuration.widgetId, configuration])));
        }).catch(() => {
            if (active) setConfigurationError("Saved chart colors are temporarily unavailable.");
        });
        return () => { active = false; };
    }, [id]);

    const saveColors = useCallback(async (widgetId: string, colors: Record<string, string>, revision: string) => {
        await updateDashboardChartColors(id, widgetId, colors, revision);
        const configurations = await loadColors();
        const saved = configurations.find(configuration => configuration.widgetId === widgetId);
        if (!saved) throw new Error("Saved chart colors could not be reloaded.");
        return saved;
    }, [id, loadColors]);

    return (
        <Dashboard
            dashboardId={id}
            chartColors={chartColors}
            canCustomizeCharts={authentication.status === "authenticated" && authentication.user.frontendRole === "application-administrator"}
            chartConfigurationError={configurationError}
            onSaveChartColors={saveColors}
        />
    );
}
