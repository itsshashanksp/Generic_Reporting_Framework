import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { useAuthenticatedUsername } from "../../auth";

export type FilterValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | (string | number | boolean)[];

export type FilterValues = Record<string, FilterValue>;

interface FilterContextType {
    filters: FilterValues;
    setFilter: (field: string, value: FilterValue) => void;
    replaceFilters: (filters: FilterValues) => void;
    clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const EMPTY_FILTERS: FilterValues = {};

export function FilterProvider({
    children,
}: {
    children: ReactNode;
}) {

    // Filter values belong to the user who entered them. Sign-out or a user
    // switch discards them before anything renders, so no page can show them.
    const owner = useAuthenticatedUsername();
    const [state, setState] = useState<{ owner: string | null; filters: FilterValues }>(
        () => ({ owner, filters: {} })
    );
    if (state.owner !== owner) {
        setState({ owner, filters: {} });
    }
    const filters = state.owner === owner ? state.filters : EMPTY_FILTERS;

    const setFilter = useCallback((field: string, value: FilterValue) => {

        setState(prev => ({
            owner,
            filters: {
                ...(prev.owner === owner ? prev.filters : {}),
                [field]: value,
            },
        }));

    }, [owner]);

    const clearFilters = useCallback(() => {

        setState({ owner, filters: {} });

    }, [owner]);

    const replaceFilters = useCallback((
        nextFilters: FilterValues
    ) => {

        setState({ owner, filters: { ...nextFilters } });

    }, [owner]);

    const contextValue = useMemo(
        () => ({
            filters,
            setFilter,
            replaceFilters,
            clearFilters,
        }),
        [filters, setFilter, replaceFilters, clearFilters]
    );

    return (

        <FilterContext.Provider
            value={contextValue}
        >

            {children}

        </FilterContext.Provider>

    );

}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilters() {

    const context = useContext(FilterContext);

    if (!context) {

        throw new Error(
            "useFilters must be used inside FilterProvider"
        );

    }

    return context;

}
