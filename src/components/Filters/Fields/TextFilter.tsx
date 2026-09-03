import { useFilters } from "../../../engine/FilterContext";
import { useId } from "react";

interface Props {
    field: string;
    label: string;
    operator?: string;
    placeholder?: string;
    required?: boolean;
}

export default function TextFilter({
    field,
    label,
    operator,
    placeholder,
    required = false,
}: Props) {

    const {
        filters,
        setFilter,
    } = useFilters();

    const storedValue = filters[field];

    const value =
        typeof storedValue === "string"
            ? storedValue
            : "";
    const inputId = useId();

    const getPlaceholder = () => {

        switch (operator) {

            case "equals":
                return "Enter exact value";

            case "startsWith":
                return "Starts with...";

            case "endsWith":
                return "Ends with...";

            case "contains":
                return "Search...";

            default:
                return "";

        }

    };

    return (

        <div className="filter-field">

            <label htmlFor={inputId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>

            <input
                id={inputId}
                type="text"
                value={value}
                placeholder={
                    placeholder ||
                    getPlaceholder()
                }
                required={required}
                onChange={(e) =>
                    setFilter(
                        field,
                        e.target.value
                    )
                }
            />

        </div>

    );

}
