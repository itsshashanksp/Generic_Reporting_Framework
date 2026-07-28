import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
}

export default function SelectFilter({
    field,
    label,
}: Props) {

    const { filters, setFilter } = useFilters();

    return (

        <div>

            <label>{label}</label>

            <select
                value={filters[field] || ""}
                onChange={(e) =>
                    setFilter(field, e.target.value)
                }
            >

                <option value="">
                    Select
                </option>

            </select>

        </div>

    );

}