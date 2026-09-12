import { useId } from "react";

import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
    required?: boolean;
}

export default function BooleanFilter({ field, label, required = false }: Props) {
    const { filters, setFilter } = useFilters();
    const inputId = useId();
    const value = filters[field];

    return (
        <div className="filter-field">
            <label htmlFor={inputId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>
            <select
                id={inputId}
                required={required}
                value={typeof value === "boolean" ? String(value) : ""}
                onChange={event => setFilter(
                    field,
                    event.target.value === "" ? undefined : event.target.value === "true"
                )}
            >
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        </div>
    );
}
