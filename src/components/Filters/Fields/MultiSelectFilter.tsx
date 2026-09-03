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

export default function MultiSelectFilter({
    field,
    label,
    options = [],
    required = false,
}: Props) {

    const {
        filters,
        setFilter,
    } = useFilters();

    const selectedValues =
        Array.isArray(filters[field])
            ? filters[field]
            : [];
    const selectId = useId();

    const handleChange = (
        event: React.ChangeEvent<HTMLSelectElement>
    ) => {

        const values = Array.from(
            event.target.selectedOptions,
            selectedOption =>
                options.find(
                    option =>
                        String(option.value) === selectedOption.value
                )?.value ?? selectedOption.value
        );

        setFilter(
            field,
            values
        );

    };

    return (

        <div className="filter-field">

            <label htmlFor={selectId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>

            <select
                id={selectId}
                multiple
                required={required}
                value={selectedValues.map(
                    String
                )}
                onChange={handleChange}
                size={Math.min(
                    Math.max(options.length, 3),
                    6
                )}
            >

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
