import { createContext } from "react";

export interface DashboardContextType {
    refreshKey: number;
    isRefreshing: boolean;
    refreshDashboard: () => void;
    finishRefresh: () => void;
}

export const DashboardContext =
    createContext<DashboardContextType | undefined>(
        undefined
    );
