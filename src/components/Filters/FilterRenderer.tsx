import type { FilterDefinition } from "../../types/filter";

import FilterField from "./FilterField";

interface Props {
    filters: FilterDefinition[];
}

export default function FilterRenderer({
    filters,
}: Props) {

    return (

        <div>

            {filters.map(filter => (

                <FilterField
                    key={filter.field}
                    filter={filter}
                />

            ))}

        </div>

    );

}