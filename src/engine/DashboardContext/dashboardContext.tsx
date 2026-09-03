import {
    useCallback,
    useMemo,
    useState,
    useEffect,
    type ReactNode,
} from "react";

import { DashboardContext } from "./context";
import type { FilterValues } from "../FilterContext/FilterContext";

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

    const [appliedFilters, setAppliedFilters] =
        useState<FilterValues>({});

    const refreshDashboard = useCallback(() => {

        setIsRefreshing(true);

        setRefreshKey(
            previous => previous + 1
        );

    }, []);

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
    refreshDashboard,
]);

    const finishRefresh = useCallback(() => {

        setIsRefreshing(false);

    }, []);

    const applyFilters = useCallback((filters: FilterValues) => {
        setAppliedFilters({ ...filters });
    }, []);

    const contextValue = useMemo(() => ({
        refreshKey,
        isRefreshing,
        refreshDashboard,
        finishRefresh,
        appliedFilters,
        applyFilters,
    }), [refreshKey, isRefreshing, refreshDashboard, finishRefresh, appliedFilters, applyFilters]);

    return (
        <DashboardContext.Provider
            value={contextValue}
        >
            {children}
        </DashboardContext.Provider>
    );
}
