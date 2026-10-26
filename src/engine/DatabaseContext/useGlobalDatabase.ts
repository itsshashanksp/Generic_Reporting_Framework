import { useContext } from "react";

import { GlobalDatabaseContext } from "./context";

export function useGlobalDatabase() {
    const context = useContext(GlobalDatabaseContext);
    if (!context) throw new Error("useGlobalDatabase must be used inside GlobalDatabaseProvider.");
    return context;
}

export function useOptionalGlobalDatabase() {
    return useContext(GlobalDatabaseContext);
}
