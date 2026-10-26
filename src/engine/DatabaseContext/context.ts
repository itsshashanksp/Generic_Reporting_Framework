import { createContext } from "react";

import type { useDatabaseRegistry } from "./databaseRegistry";

export interface GlobalDatabaseValue {
    database: string;
    configuredDatabase: string;
    resolving: boolean;
    registry: ReturnType<typeof useDatabaseRegistry>;
    save: (database: string) => boolean;
}

export const GlobalDatabaseContext = createContext<GlobalDatabaseValue | undefined>(undefined);
