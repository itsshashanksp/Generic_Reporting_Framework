import type { FilterDefinition } from "../../types/filter";

import FilterField from "./FilterField";

interface Props {
    filters: FilterDefinition[];
    database?: string;
}

export default function FilterRenderer({
    filters,
    database,
}: Props) {

    return (

        <div className="filter-grid">

            {filters
                .filter(filter => filter.visible !== false)
                .map(filter => (

                <FilterField
                    key={filter.field}
                    filter={filter}
                    database={database}
                />

                ))}

        </div>

    );

}
