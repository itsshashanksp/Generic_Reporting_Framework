import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
}

export default function NullFilter({
    field,
    label,
}: Props) {

    const {
        filters,
        setFilter,
    } = useFilters();

    const checked =
        filters[field] === true;

    return (
        <div>

            <label>

                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                        setFilter(
                            field,
                            e.target.checked
                                ? true
                                : undefined
                        )
                    }
                />

                {label}

            </label>

        </div>
    );
}