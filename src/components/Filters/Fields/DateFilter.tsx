import { useFilters } from "../../../engine/FilterContext";
import { useId } from "react";

interface Props {
    field: string;
    label: string;
    required?: boolean;
}

export default function DateFilter({
    field,
    label,
    required = false,
}: Props) {

    const { filters, setFilter } = useFilters();

    const storedValue = filters[field];

    const value =
        typeof storedValue === "string"
            ? storedValue
            : "";
    const inputId = useId();

    return (

        <div className="filter-field">

            <label htmlFor={inputId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>

            <input
                id={inputId}
                type="date"
                required={required}
                value={value}
                onChange={(e) =>
                    setFilter(field, e.target.value)
                }
            />

        </div>

    );

}
