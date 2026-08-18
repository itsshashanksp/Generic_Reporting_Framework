import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

interface DashboardContextType {
    refreshKey: number;
    refreshDashboard: () => void;
}

const DashboardContext =
    createContext<DashboardContextType | undefined>(
        undefined
    );

export function DashboardProvider({
    children,
}: {
    children: ReactNode;
}) {

    const [refreshKey, setRefreshKey] =
        useState(0);

    const refreshDashboard = () => {

        setRefreshKey(
            previous => previous + 1
        );

    };

    return (
        <DashboardContext.Provider
            value={{
                refreshKey,
                refreshDashboard,
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {

    const context =
        useContext(DashboardContext);

    if (!context) {

        throw new Error(
            "useDashboard must be used inside DashboardProvider"
        );

    }

    return context;
}