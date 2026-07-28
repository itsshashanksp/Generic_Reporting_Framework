import {
    createContext,
    useContext,
    useState,
    type ReactNode,
} from "react";

type FilterValues = Record<string, any>;

interface FilterContextType {
    filters: FilterValues;
    setFilter: (field: string, value: any) => void;
    clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({
    children,
}: {
    children: ReactNode;
}) {

    const [filters, setFilters] = useState<FilterValues>({});

    const setFilter = (field: string, value: any) => {

        setFilters(prev => ({
            ...prev,
            [field]: value,
        }));

    };

    const clearFilters = () => {

        setFilters({});

    };

    return (

        <FilterContext.Provider
            value={{
                filters,
                setFilter,
                clearFilters,
            }}
        >

            {children}

        </FilterContext.Provider>

    );

}

export function useFilters() {

    const context = useContext(FilterContext);

    if (!context) {

        throw new Error(
            "useFilters must be used inside FilterProvider"
        );

    }

    return context;

}