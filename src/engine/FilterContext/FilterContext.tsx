import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export type FilterValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | (string | number)[];

export type FilterValues = Record<string, FilterValue>;

interface FilterContextType {
    filters: FilterValues;
    setFilter: (field: string, value: FilterValue) => void;
    replaceFilters: (filters: FilterValues) => void;
    clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({
    children,
}: {
    children: ReactNode;
}) {

    const [filters, setFilters] = useState<FilterValues>({});

    const setFilter = useCallback((field: string, value: FilterValue) => {

        setFilters(prev => ({
            ...prev,
            [field]: value,
        }));

    }, []);

    const clearFilters = useCallback(() => {

        setFilters({});

    }, []);

    const replaceFilters = useCallback((
        nextFilters: FilterValues
    ) => {

        setFilters({ ...nextFilters });

    }, []);

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
