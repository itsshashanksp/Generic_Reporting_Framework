import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
}

export default function DateFilter({
    field,
    label,
}: Props) {

    const { filters, setFilter } = useFilters();

    const storedValue = filters[field];

    const value =
        typeof storedValue === "string"
            ? storedValue
            : "";

    return (

        <div>

            <label>{label}</label>

            <input
                type="date"
                value={value}
                onChange={(e) =>
                    setFilter(field, e.target.value)
                }
            />

        </div>

    );

}
