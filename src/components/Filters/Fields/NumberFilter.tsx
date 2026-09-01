import { useFilters } from "../../../engine/FilterContext";

import type { FilterOperator } from "../../../types/filter";

interface Props {
    field: string;
    label: string;
    operator?: FilterOperator;
    placeholder?: string;
}

export default function NumberFilter({
    field,
    label,
    operator,
    placeholder,
}: Props) {
    const { filters, setFilter } = useFilters();

    if (
        operator === "between" ||
        operator === "notBetween"
    ) {
        const range = Array.isArray(filters[field])
            ? filters[field]
            : ["", ""];

        return (
            <div>
                <label>{label}</label>
                <div style={{ display: "flex", gap: "8px" }}>
                    <input
                        type="number"
                        value={range[0] ?? ""}
                        placeholder="Minimum"
                        onChange={(event) =>
                            setFilter(field, [
                                event.target.value,
                                range[1] ?? "",
                            ])
                        }
                    />
                    <span>to</span>
                    <input
                        type="number"
                        value={range[1] ?? ""}
                        placeholder="Maximum"
                        onChange={(event) =>
                            setFilter(field, [
                                range[0] ?? "",
                                event.target.value,
                            ])
                        }
                    />
                </div>
            </div>
        );
    }

    const value = filters[field];

    return (
        <div>
            <label>{label}</label>
            <input
                type="number"
                value={
                    typeof value === "number" ||
                    typeof value === "string"
                        ? value
                        : ""
                }
                placeholder={placeholder}
                onChange={(event) =>
                    setFilter(field, event.target.value)
                }
            />
        </div>
    );
}
