import { useFilters } from "../../engine/FilterContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";
import type { FilterDefinition } from "../../types/filter";

import {
    useEffect,
    useState,
} from "react";

import { executeRequest } from "../../api/request";

import { useDashboard } from "../../engine/DashboardContext";

import type { WidgetRequest } from "../../types/widget";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];

interface StatWidgetProps {
    title: string;

    description?: string;

    request: WidgetRequest;

    format?: "number" | "currency" | "decimal";

    filterDefinitions?: FilterDefinition[];
}

export default function StatWidget({
    title,
    description,
    request,
    format,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
}: StatWidgetProps) {

    const { filters } = useFilters();
    const { refreshKey } = useDashboard();

    const [value, setValue] =
        useState<string | number>("—");

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [empty, setEmpty] =
        useState(false);

    useEffect(() => {

        const loadStat = async () => {

            try {

                setLoading(true);

                setError(null);

                setEmpty(false);

                const response =
                    await executeRequest({

                        ...request,

                        where: [
                            ...(request.where ?? []),

                            ...buildWhere(
                                filters,
                                filterDefinitions,
                            ),
                        ],

                    });

                if (
                    response.success &&
                    response.data?.length
                ) {

                    const firstRow =
                        response.data[0];

                    const firstValue =
                        Object.values(
                            firstRow
                        )[0];

                    setValue(
                        firstValue as
                            | string
                            | number
                    );

                } else if (
                    response.success &&
                    !response.data?.length
                ) {

                    setEmpty(true);

                    setValue("—");

                } else {

                    setError(
                        response.message ||
                        "Failed to load statistic."
                    );

                    setValue("—");

                }

            }
            catch (error) {

                console.error(
                    "Failed to load stat:",
                    error
                );

                setError(
                    "Failed to load statistic."
                );

                setValue("—");

            }
            finally {

                setLoading(false);

            }

        };

        loadStat();

    }, [
        request,
        filters,
        filterDefinitions,
        refreshKey,
    ]);

    const formatValue = (
        value: string | number
    ) => {

        const numericValue =
            Number(value);

        if (Number.isNaN(numericValue)) {

            return value;

        }

        switch (format) {

            case "currency":

                return numericValue.toLocaleString(
                    "en-IN",
                    {
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                );

            case "decimal":

                return numericValue.toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                );

            case "number":

                return numericValue.toLocaleString(
                    "en-IN"
                );

            default:

                return numericValue.toLocaleString(
                    "en-IN"
                );
        }
    };

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
        >

            <div
                style={{
                    fontSize: "14px",
                    opacity: 0.7,
                    marginBottom: "4px",
                }}
            >
                {title}
            </div>

            {description && (
                <div
                    style={{
                        fontSize: "12px",
                        opacity: 0.6,
                        marginBottom: "8px",
                    }}
                >
                    {description}
                </div>
            )}

            <div
                style={{
                    fontSize: "32px",
                    fontWeight: 600,
                }}
            >

                {loading
                    ? "Loading..."

                    : error
                        ? "Error"

                        : empty
                            ? "No Data"

                            : formatValue(value)}

            </div>

            {error && (
                <div
                    style={{
                        fontSize: "12px",
                        color: "red",
                        marginTop: "6px",
                    }}
                >
                    {error}
                </div>
            )}

        </div>
    );
}
