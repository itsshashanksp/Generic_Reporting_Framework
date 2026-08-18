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

interface ChartWidgetProps {
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

        groupBy?: string[];
    };

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
    const { refreshKey } = useDashboard();
    
    const [data, setData] = useState<
        {
            name: string;
            value: number;
        }[]
    >([]);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {

        const loadChart = async () => {

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
                    response.data
                ) {

                    const chartData =
                        response.data.map(
                            (row: any) => ({
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

                }

            }
            catch (error) {

                console.error(
                    "Failed to load chart:",
                    error
                );

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
            <div>
                Loading...
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
                }}
            >
                {title}
            </h2>

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