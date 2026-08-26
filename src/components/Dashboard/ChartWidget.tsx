import { useFilters } from "../../engine/FilterContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";

import { useDashboard } from "../../engine/DashboardContext";

import {
    useEffect,
    useState,
} from "react";

import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

import { executeRequest } from "../../api/request";

import type { WidgetRequest } from "../../types/widget";

interface ChartWidgetProps {
    title: string;

    description?: string;

    request: WidgetRequest;

    xField: string;
    yField: string;

    chartType?: "bar" | "line" | "pie";

    showLegend?: boolean;
    showTooltip?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;
}

export default function ChartWidget({
    title,
    description,
    request,
    xField,
    yField,
    chartType = "bar",
    showLegend = false,
    showTooltip = true,
    showGrid = true,
    showLabels = false,
}: ChartWidgetProps) {

    const { filters } = useFilters();

    const { refreshKey } =
        useDashboard();

    const [data, setData] = useState<
        {
            name: string;
            value: number;
        }[]
    >([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [empty, setEmpty] =
        useState(false);

    useEffect(() => {

        const loadChart = async () => {

            try {

                setLoading(true);

                setError(null);

                setEmpty(false);

                const response =
                    await executeRequest({

                        ...request,

                        where: [
                            ...(request.where ?? []),

                            ...buildWhere(filters),
                        ],

                    });

                if (
                    response.success &&
                    response.data?.length
                ) {

                    const chartData =
                        response.data.map(
                            (row: Record<string, unknown>) => ({
                                name:
                                    String(
                                        row[xField]
                                        ?? ""
                                    ),

                                value:
                                    Number(
                                        row[yField]
                                        ?? 0
                                    ),
                            })
                        );

                    setData(chartData);

                } else if (
                    response.success &&
                    !response.data?.length
                ) {

                    setEmpty(true);

                    setData([]);

                } else {

                    setError(
                        response.message ||
                        "Failed to load chart."
                    );

                    setData([]);

                }

            }
            catch (error) {

                console.error(
                    "Failed to load chart:",
                    error
                );

                setError(
                    "Failed to load chart."
                );

                setData([]);

            }
            finally {

                setLoading(false);

            }

        };

        loadChart();

    }, [
        request,
        xField,
        yField,
        filters,
        refreshKey,
    ]);

    if (loading) {

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >
                <h2
                    style={{
                        marginTop: 0,
                        marginBottom: "4px",
                    }}
                >
                    {title}
                </h2>

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

                <div>Loading...</div>
            </div>
        );

    }

    if (error) {

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >

                <h2
                    style={{
                          marginTop: 0,
                          marginBottom: "4px",
                    }}
                >
                    {title}
                </h2>

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
                        padding: "20px",
                        textAlign: "center",
                        color: "red",
                    }}
                >

                    <strong>
                        Failed to load chart
                    </strong>

                    <div
                        style={{
                            fontSize: "12px",
                            marginTop: "6px",
                        }}
                    >
                        {error}
                    </div>

                </div>

            </div>
        );

    }

    if (empty) {

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >

                <h2
                    style={{
                        marginTop: 0,
                        marginBottom: "4px",
                    }}
                >
                    {title}
                </h2>

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
                        padding: "20px",
                        textAlign: "center",
                    }}
                >

                    <strong>
                        No Data
                    </strong>

                    <div
                        style={{
                            fontSize: "12px",
                            marginTop: "6px",
                            opacity: 0.7,
                        }}
                    >
                        The query returned no data.
                    </div>

                </div>

            </div>
        );

    }

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
        >

            <h2
                style={{
                    marginTop: 0,
                    marginBottom: "4px",
                }}
            >
                {title}
            </h2>

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
                    width: "100%",
                    height: "calc(100% - 40px)",
                }}
            >

                <ResponsiveContainer
                    width="100%"
                    height="100%"
                >

                    {chartType === "line" ? (

                        <LineChart
                            data={data}
                        >

                            {showGrid && (
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                />
                            )}

                            <XAxis
                                dataKey="name"
                            />

                            <YAxis />

                            {showTooltip && (
                                <Tooltip />
                            )}

                            {showLegend && (
                                <Legend />
                            )}

                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="currentColor"
                                label={
                                    showLabels
                                        ? true
                                        : false
                                }
                            />

                        </LineChart>

                    ) : chartType === "pie" ? (

                        <PieChart>

                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius="70%"
                                label={
                                    showLabels
                                        ? true
                                        : false
                                }
                            >

                                {data.map(
                                    (_, index) => (
                                        <Cell
                                            key={
                                                `cell-${index}`
                                            }
                                        />
                                    )
                                )}

                            </Pie>

                            {showTooltip && (
                                <Tooltip />
                            )}

                            {showLegend && (
                                <Legend />
                            )}

                        </PieChart>

                    ) : (

                        <BarChart
                            data={data}
                        >

                            {showGrid && (
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                />
                            )}

                            <XAxis
                                dataKey="name"
                            />

                            <YAxis />

                            {showTooltip && (
                                <Tooltip />
                            )}

                            {showLegend && (
                                <Legend />
                            )}

                            <Bar
                                dataKey="value"
                                label={
                                    showLabels
                                        ? true
                                        : false
                                }
                            />

                        </BarChart>

                    )}

                </ResponsiveContainer>

            </div>

        </div>
    );
}
