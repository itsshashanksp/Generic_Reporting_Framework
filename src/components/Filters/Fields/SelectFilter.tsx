import { useFilters } from "../../../engine/FilterContext";
import { useId } from "react";

interface Option {
    label: string;
    value: string | number;
}

interface Props {
    field: string;
    label: string;
    options?: Option[];
    required?: boolean;
}

export default function SelectFilter({
    field,
    label,
    options = [],
    required = false,
}: Props) {

    const { filters, setFilter } =
        useFilters();
    const selectId = useId();

    return (

        <div className="filter-field">

            <label htmlFor={selectId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>

            <select
                id={selectId}
                required={required}
                value={
                    filters[field] === undefined ||
                    filters[field] === null
                        ? ""
                        : String(filters[field])
                }
                onChange={(e) =>
                    setFilter(field,
                        options.find(
                            option =>
                                String(option.value) === e.target.value
                        )?.value ?? ""
                    )
                }
            >

                <option value="">
                    Select
                </option>

                {options.map(option => (

                    <option
                        key={`${typeof option.value}:${String(option.value)}`}
                        value={String(option.value)}
                    >
                        {option.label}
                    </option>

                ))}

            </select>

        </div>

    );

}
