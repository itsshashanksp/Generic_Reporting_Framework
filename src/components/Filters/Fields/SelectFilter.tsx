import { useFilters } from "../../../engine/FilterContext";

interface Option {
    label: string;
    value: string | number;
}

interface Props {
    field: string;
    label: string;
    options?: Option[];
}

export default function SelectFilter({
    field,
    label,
    options = [],
}: Props) {

    const { filters, setFilter } =
        useFilters();

    return (

        <div>

            <label>{label}</label>

            <select
                value={
                    filters[field] === undefined ||
                    filters[field] === null
                        ? ""
                        : String(filters[field])
                }
                onChange={(e) =>
                    setFilter(field,
                        options.find(
                            option =>
                                String(option.value) === e.target.value
                        )?.value ?? ""
                    )
                }
            >

                <option value="">
                    Select
                </option>

                {options.map(option => (

                    <option
                        key={`${typeof option.value}:${String(option.value)}`}
                        value={String(option.value)}
                    >
                        {option.label}
                    </option>

                ))}

            </select>

        </div>

    );

}
