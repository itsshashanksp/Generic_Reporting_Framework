import { useFilters } from "../../../engine/FilterContext";

interface Option {
    label: string;
    value: string | number;
}

interface Props {
    field: string;
    label: string;
    options?: Option[];
}

export default function MultiSelectFilter({
    field,
    label,
    options = [],
}: Props) {

    const {
        filters,
        setFilter,
    } = useFilters();

    const selectedValues =
        Array.isArray(filters[field])
            ? filters[field]
            : [];

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

        <div>

            <label>{label}</label>

            <select
                multiple
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
