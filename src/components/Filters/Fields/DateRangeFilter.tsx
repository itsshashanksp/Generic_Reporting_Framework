import { useFilters } from "../../../engine/FilterContext";

interface Props {
    field: string;
    label: string;
}

export default function DateRangeFilter({
    field,
    label,
}: Props) {

    const { filters, setFilter } =
        useFilters();

    const value =
        Array.isArray(filters[field])
            ? filters[field]
            : ["", ""];

    const startDate =
        value[0] || "";

    const endDate =
        value[1] || "";

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
        <div>

            <label>{label}</label>

            <div
                style={{
                    display: "flex",
                    gap: "8px",
                }}
            >

                <input
                    type="date"
                    value={startDate}
                    onChange={(e) =>
                        handleStartChange(
                            e.target.value
                        )
                    }
                />

                <span>
                    to
                </span>

                <input
                    type="date"
                    value={endDate}
                    onChange={(e) =>
                        handleEndChange(
                            e.target.value
                        )
                    }
                />

            </div>

        </div>
    );
}