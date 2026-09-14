import { useFilters } from "../../../engine/FilterContext";
import { useId } from "react";
import { useMemo, useState } from "react";
import type { DynamicFilterOptions, FilterOption } from "../../../types/filter";
import { useDynamicFilterOptions } from "../useDynamicFilterOptions";

const optionKey = (option: Pick<FilterOption, "value">) => `${typeof option.value}:${String(option.value)}`;

interface Props {
    field: string;
    label: string;
    options?: FilterOption[];
    dynamicOptions?: DynamicFilterOptions;
    required?: boolean;
}

export default function SelectFilter({
    field,
    label,
    options = [],
    dynamicOptions,
    required = false,
}: Props) {

    const { filters, setFilter } =
        useFilters();
    const selectId = useId();
    const searchId = useId();
    const [search, setSearch] = useState("");
    const dynamic = useDynamicFilterOptions(dynamicOptions);
    const availableOptions = dynamicOptions ? dynamic.options : options;
    const displayedOptions = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        if (!term) return availableOptions;
        return availableOptions.filter(option =>
            option.label.toLocaleLowerCase().includes(term)
            || String(option.value).toLocaleLowerCase().includes(term)
        );
    }, [availableOptions, search]);

    return (

        <div className="filter-field">

            <label htmlFor={selectId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>

            {dynamicOptions?.searchable !== false && (
                <input
                    id={searchId}
                    type="search"
                    aria-label={`Search ${label}`}
                    placeholder={dynamicOptions?.searchPlaceholder ?? `Search ${label.toLocaleLowerCase()}`}
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                />
            )}

            <select
                id={selectId}
                required={required}
                value={
                    filters[field] === undefined ||
                    filters[field] === null
                        ? ""
                        : `${typeof filters[field]}:${String(filters[field])}`
                }
                onChange={(e) =>
                    setFilter(field,
                        availableOptions.find(
                            option =>
                                optionKey(option) === e.target.value
                        )?.value ?? ""
                    )
                }
            >

                <option value="">
                    Select
                </option>

                {displayedOptions.map(option => (

                    <option
                        key={`${typeof option.value}:${String(option.value)}`}
                        value={optionKey(option)}
                    >
                        {option.label}{option.count !== undefined ? ` (${option.count.toLocaleString("en-IN")})` : ""}
                    </option>

                ))}

            </select>

            {dynamic.loading && <small role="status">Loading values…</small>}
            {dynamic.error && <small role="alert">{dynamic.error}</small>}

        </div>

    );

}
