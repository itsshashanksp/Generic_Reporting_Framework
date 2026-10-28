import App from "./App";
import { AuthProvider } from "./auth";
import { FilterProvider } from "./engine/FilterContext";
import { GridProvider } from "./engine/GridContext";
import { GlobalDatabaseProvider } from "./engine/DatabaseContext";
import { useSetup } from "./setup";
import { ToastProvider } from "./components/Notifications/ToastProvider";

export default function ApplicationProviders() {
    const { state } = useSetup();

    return (
        <AuthProvider enabled={state.status === "complete"}>
            <ToastProvider>
                <GlobalDatabaseProvider>
                    <GridProvider>
                        <FilterProvider>
                            <App />
                        </FilterProvider>
                    </GridProvider>
                </GlobalDatabaseProvider>
            </ToastProvider>
        </AuthProvider>
    );
}
