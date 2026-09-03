import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
    required?: boolean;
}

export default function NullFilter({
    field,
    label,
    required = false,
}: Props) {

    const {
        filters,
        setFilter,
    } = useFilters();

    const checked =
        filters[field] === true;

    return (
        <div className="filter-field">

            <label className="filter-checkbox">

                <input
                    type="checkbox"
                    checked={checked}
                    required={required}
                    onChange={(e) =>
                        setFilter(
                            field,
                            e.target.checked
                                ? true
                                : undefined
                        )
                    }
                />

                <span>
                    {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
                </span>

            </label>

        </div>
    );
}
