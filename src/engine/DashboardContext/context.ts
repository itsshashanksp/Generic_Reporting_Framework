import { createContext } from "react";
import type { FilterValues } from "../FilterContext/FilterContext";

export interface DashboardContextType {
    refreshKey: number;
    isRefreshing: boolean;
    refreshDashboard: () => void;
    finishRefresh: () => void;
    appliedFilters: FilterValues;
    applyFilters: (filters: FilterValues) => void;
}

export const DashboardContext =
    createContext<DashboardContextType | undefined>(
        undefined
    );
