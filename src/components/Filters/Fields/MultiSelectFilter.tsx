import { useFilters } from "../../../engine/FilterContext";
import { useId, useMemo, useState } from "react";
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

export default function MultiSelectFilter({
    field,
    label,
    options = [],
    dynamicOptions,
    required = false,
}: Props) {

    const {
        filters,
        setFilter,
    } = useFilters();

    const selectedValues =
        Array.isArray(filters[field])
            ? filters[field]
            : [];
    const selectId = useId();
    const [search, setSearch] = useState("");
    const dynamic = useDynamicFilterOptions(dynamicOptions);
    const availableOptions = dynamicOptions ? dynamic.options : options;
    const displayedOptions = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        return term
            ? availableOptions.filter(option => option.label.toLocaleLowerCase().includes(term))
            : availableOptions;
    }, [availableOptions, search]);

    const handleChange = (
        event: React.ChangeEvent<HTMLSelectElement>
    ) => {

        const values = Array.from(
            event.target.selectedOptions,
            selectedOption =>
                availableOptions.find(
                    option =>
                        optionKey(option) === selectedOption.value
                )?.value ?? selectedOption.value
        );

        setFilter(
            field,
            values
        );

    };

    return (

        <div className="filter-field">

            <label htmlFor={selectId}>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </label>

            {dynamicOptions?.searchable !== false && (
                <input
                    type="search"
                    aria-label={`Search ${label}`}
                    placeholder={dynamicOptions?.searchPlaceholder ?? `Search ${label.toLocaleLowerCase()}`}
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                />
            )}

            <select
                id={selectId}
                multiple
                required={required}
                value={selectedValues.map(
                    value => `${typeof value}:${String(value)}`
                )}
                onChange={handleChange}
                size={Math.min(
                    Math.max(displayedOptions.length, 3),
                    6
                )}
            >

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
