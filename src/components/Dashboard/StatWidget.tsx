import { useFilters } from "../../engine/FilterContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";

import {
    useEffect,
    useState,
} from "react";

import { executeRequest } from "../../api/request";

import { useDashboard } from "../../engine/DashboardContext";

interface StatWidgetProps {
    title: string;

    request: {
        controller: string;
        action: string;
        table: string;
        columns: (
            | string
            | {
                  function: string;
                  column: string;
                  alias?: string;
              }
        )[];
    };

    format?: "number" | "currency" | "decimal";
}

export default function StatWidget({
    title,
    request,
    format,
}: StatWidgetProps) {

    const { filters } = useFilters();
    const { refreshKey } = useDashboard();

    const [value, setValue] =
        useState<string | number>("—");

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {

        const loadStat = async () => {

            try {

                setLoading(true);

                const response =
                    await executeRequest({
                        ...request,

                        where: [
                            ...(Array.isArray(
                               (request as any).where
                            )
                                ? (request as any).where
                                : []),

                            ...buildWhere(filters),
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

                }

            }
            catch (error) {

                console.error(
                    "Failed to load stat:",
                    error
                );

                setValue("—");

            }
            finally {

                setLoading(false);

            }

        };

        loadStat();

    }, [request, filters, refreshKey]);

    const formatValue = (
        value: string | number
    ) => {

        const numericValue = Number(value);

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
                    marginBottom: "8px",
                }}
            >
                {title}
            </div>

            <div
                style={{
                    fontSize: "32px",
                    fontWeight: 600,
                }}
            >
                {loading
                    ? "Loading..."
                    : formatValue(value)}
            </div>

        </div>
    );
}