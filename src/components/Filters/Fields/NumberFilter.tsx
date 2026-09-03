import { useFilters } from "../../../engine/FilterContext";
import { useId } from "react";

import type { FilterOperator } from "../../../types/filter";

interface Props {
    field: string;
    label: string;
    operator?: FilterOperator;
    placeholder?: string;
    required?: boolean;
}

export default function NumberFilter({
    field,
    label,
    operator,
    placeholder,
    required = false,
}: Props) {
    const { filters, setFilter } = useFilters();
    const inputId = useId();
    const minimumId = useId();
    const maximumId = useId();

    if (
        operator === "between" ||
        operator === "notBetween"
    ) {
        const range = Array.isArray(filters[field])
            ? filters[field]
            : ["", ""];

        return (
            <fieldset className="filter-field">
                <legend>
                    {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
                </legend>
                <div className="filter-range">
                    <label className="visually-hidden" htmlFor={minimumId}>{label} minimum</label>
                    <input
                        id={minimumId}
                        type="number"
                        value={range[0] ?? ""}
                        placeholder="Minimum"
                        required={required}
                        onChange={(event) =>
                            setFilter(field, [
                                event.target.value,
                                range[1] ?? "",
                            ])
                        }
                    />
                    <span className="filter-range__separator">to</span>
                    <label className="visually-hidden" htmlFor={maximumId}>{label} maximum</label>
                    <input
                        id={maximumId}
                        type="number"
                        value={range[1] ?? ""}
                        placeholder="Maximum"
                        required={required}
                        onChange={(event) =>
                            setFilter(field, [
                                range[0] ?? "",
                                event.target.value,
                            ])
                        }
                    />
                </div>
            </fieldset>
        );
    }

    const value = filters[field];

    return (
        <div className="filter-field">
            <label htmlFor={inputId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>
            <input
                id={inputId}
                type="number"
                value={
                    typeof value === "number" ||
                    typeof value === "string"
                        ? value
                        : ""
                }
                placeholder={placeholder}
                required={required}
                onChange={(event) =>
                    setFilter(field, event.target.value)
                }
            />
        </div>
    );
}
