import {
    useState,
    useEffect,
    type ReactNode,
} from "react";

import { DashboardContext } from "./context";

export function DashboardProvider({
    children,
    autoRefresh,
}: {
    children: ReactNode;
    autoRefresh?: {
        enabled?: boolean;
        interval?: number;
    };
}) {

    const [isRefreshing, setIsRefreshing] =
        useState(false);

    const [refreshKey, setRefreshKey] =
        useState(0);

    const refreshDashboard = () => {

        setIsRefreshing(true);

        setRefreshKey(
            previous => previous + 1
        );

    };

useEffect(() => {

    if (
        !autoRefresh?.enabled ||
        !autoRefresh.interval ||
        autoRefresh.interval <= 0
    ) {
        return;
    }

    const timer = setInterval(() => {

        refreshDashboard();

    }, autoRefresh.interval);

    return () => {

        clearInterval(timer);

    };

}, [
    autoRefresh?.enabled,
    autoRefresh?.interval,
]);

    const finishRefresh = () => {

        setIsRefreshing(false);

    };

    return (
        <DashboardContext.Provider
            value={{
                refreshKey,
                isRefreshing,
                refreshDashboard,
                finishRefresh,
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
}
