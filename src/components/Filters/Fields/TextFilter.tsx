import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
    operator?: string;
    placeholder?: string;
}

export default function TextFilter({
    field,
    label,
    operator,
    placeholder,
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

        <div>

            <label>{label}</label>

            <input
                type="text"
                value={value}
                placeholder={
                    placeholder ||
                    getPlaceholder()
                }
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
