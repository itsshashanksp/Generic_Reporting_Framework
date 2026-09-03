import type { FilterDefinition } from "../../types/filter";

import FilterField from "./FilterField";
import "./Filters.css";

interface Props {
    filters: FilterDefinition[];
}

export default function FilterRenderer({
    filters,
}: Props) {

    return (

        <div className="filter-grid">

            {filters
                .filter(filter => filter.visible !== false)
                .map(filter => (

                <FilterField
                    key={filter.field}
                    filter={filter}
                />

                ))}

        </div>

    );

}
