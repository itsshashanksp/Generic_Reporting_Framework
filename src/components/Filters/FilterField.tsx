import type { FilterDefinition } from "../../types/filter";

import TextFilter from "./Fields/TextFilter";
import SelectFilter from "./Fields/SelectFilter";
import DateFilter from "./Fields/DateFilter";

import DateRangeFilter from "./Fields/DateRangeFilter";

import MultiSelectFilter from "./Fields/MultiSelectFilter";

import NullFilter from "./Fields/NullFilter";
import NumberFilter from "./Fields/NumberFilter";
import BooleanFilter from "./Fields/BooleanFilter";

interface Props {
    filter: FilterDefinition;
}

export default function FilterField({
    filter,
}: Props) {

        if (
            filter.operator === "isNull" ||
            filter.operator === "isNotNull"
        ) {

            return (
                <NullFilter
                    field={filter.field}
                    label={filter.label}
                    required={filter.required}
                />
            );

        }

    switch (filter.type) {

        case "text":

            return (
                <TextFilter
                    field={filter.field}
                    label={filter.label}
                    operator={filter.operator}
                    placeholder={filter.placeholder}
                    required={filter.required}
                />
            );

        case "number":

            return (
                <NumberFilter
                    field={filter.field}
                    label={filter.label}
                    operator={filter.operator}
                    placeholder={filter.placeholder}
                    required={filter.required}
                />
            );

        case "select":

            return (
                <SelectFilter
                    field={filter.field}
                    label={filter.label}
                    options={filter.options}
                    required={filter.required}
                />
            );

        case "multiselect":

           return (
               <MultiSelectFilter
                   field={filter.field}
                   label={filter.label}
                   options={filter.options}
                   required={filter.required}
               />
           );

        case "date":

            return (
                <DateFilter
                    field={filter.field}
                    label={filter.label}
                    required={filter.required}
                />
            )

        case "boolean":

            return (
                <BooleanFilter
                    field={filter.field}
                    label={filter.label}
                    required={filter.required}
                />
            );

        case "daterange":

           return (
               <DateRangeFilter
                   field={filter.field}
                   label={filter.label}
                   required={filter.required}
               />
           );

        default:

            return null;

    }

}
