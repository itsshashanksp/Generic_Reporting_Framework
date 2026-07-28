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

    return (

        <div>

            <label>{label}</label>

            <input
                type="date"
                value={filters[field] || ""}
                onChange={(e) =>
                    setFilter(field, e.target.value)
                }
            />

        </div>

    );

}