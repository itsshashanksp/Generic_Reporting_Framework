import {
    createContext,
    useContext,
    useState,
} from "react";

import type { ReactNode } from "react";

import type { GridApi } from "ag-grid-community";

interface GridContextType {
    api: GridApi | null;
    setApi: (api: GridApi) => void;
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export function GridProvider({
    children,
}: {
    children: ReactNode;
}) {

    const [api, setApi] = useState<GridApi | null>(null);

    return (
        <GridContext.Provider value={{ api, setApi }}>
            {children}
        </GridContext.Provider>
    );

}

export function useGrid() {

    const context = useContext(GridContext);

    if (!context)
        throw new Error("useGrid must be used inside GridProvider");

    return context;

}