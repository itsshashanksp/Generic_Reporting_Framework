import type { FilterDefinition } from "../../types/filter";

import TextFilter from "./Fields/TextFilter";
import SelectFilter from "./Fields/SelectFilter";
import DateFilter from "./Fields/DateFilter";

interface Props {
    filter: FilterDefinition;
}

export default function FilterField({
    filter,
}: Props) {

    switch (filter.type) {

        case "text":

            return (
                <TextFilter
                    field={filter.field}
                    label={filter.label}
                />
            );

        case "select":

            return (
                <SelectFilter
                    field={filter.field}
                    label={filter.label}
                />
            );

        case "date":

            return (
                <DateFilter
                    field={filter.field}
                    label={filter.label}
                />
            );

        default:

            return null;

    }

}