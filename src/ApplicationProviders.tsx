import App from "./App";
import { AuthProvider } from "./auth";
import { FilterProvider } from "./engine/FilterContext";
import { GridProvider } from "./engine/GridContext";
import { GlobalDatabaseProvider } from "./engine/DatabaseContext";
import { useSetup } from "./setup";

export default function ApplicationProviders() {
    const { state } = useSetup();

    return (
        <AuthProvider enabled={state.status === "complete"}>
            <GlobalDatabaseProvider>
                <GridProvider>
                    <FilterProvider>
                        <App />
                    </FilterProvider>
                </GridProvider>
            </GlobalDatabaseProvider>
        </AuthProvider>
    );
}
