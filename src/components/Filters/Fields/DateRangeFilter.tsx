import { useFilters } from "../../../engine/FilterContext";
import { useId } from "react";

interface Props {
    field: string;
    label: string;
    required?: boolean;
}

export default function DateRangeFilter({
    field,
    label,
    required = false,
}: Props) {

    const { filters, setFilter } =
        useFilters();

    const value =
        Array.isArray(filters[field])
            ? filters[field]
            : ["", ""];

    const startDate =
        typeof value[0] === "string" ? value[0] : "";

    const endDate =
        typeof value[1] === "string" ? value[1] : "";
    const startId = useId();
    const endId = useId();

    const handleStartChange = (
        newValue: string
    ) => {

        setFilter(
            field,
            [
                newValue,
                endDate,
            ]
        );

    };

    const handleEndChange = (
        newValue: string
    ) => {

        setFilter(
            field,
            [
                startDate,
                newValue,
            ]
        );

    };

    return (
        <fieldset className="filter-field">

            <legend>
                {label}{required && <span className="filter-required" aria-hidden="true"> *</span>}
            </legend>

            <div className="filter-range">

                <label className="visually-hidden" htmlFor={startId}>{label} start</label>
                <input
                    id={startId}
                    type="date"
                    value={startDate}
                    aria-required={required}
                    onChange={(e) =>
                        handleStartChange(
                            e.target.value
                        )
                    }
                />

                <span className="filter-range__separator">
                    to
                </span>

                <label className="visually-hidden" htmlFor={endId}>{label} end</label>
                <input
                    id={endId}
                    type="date"
                    value={endDate}
                    aria-required={required}
                    onChange={(e) =>
                        handleEndChange(
                            e.target.value
                        )
                    }
                />

            </div>

        </fieldset>
    );
}
