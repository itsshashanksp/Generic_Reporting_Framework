import { useFilters } from "../../engine/FilterContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";

import { useDashboard } from "../../engine/DashboardContext";

import type { FilterDefinition } from "../../types/filter";

import {
    useEffect,
    useState,
} from "react";

import { executeRequest } from "../../api/request";

import type { WidgetRequest } from "../../types/widget";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];

interface TableWidgetProps {
    title: string;

    description?: string;

    pageSize?: number;

    request: WidgetRequest;

    filterDefinitions?: FilterDefinition[];
}

type SortDirection =
    | "asc"
    | "desc";

export default function TableWidget({
    title,
    description,
    pageSize = 10,
    request,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
}: TableWidgetProps) {

    const { filters } =
        useFilters();

    const { refreshKey } =
        useDashboard();

    const [rows, setRows] =
        useState<Record<string, unknown>[]>(
            []
        );

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [empty, setEmpty] =
        useState(false);

    const [currentPage, setCurrentPage] =
        useState(1);

    const [sortColumn, setSortColumn] =
        useState<string | null>(null);

    const [sortDirection, setSortDirection] =
        useState<SortDirection>("asc");

    useEffect(() => {

        const loadTable = async () => {

            try {

                setLoading(true);

                setError(null);

                setEmpty(false);

                setCurrentPage(1);

                setSortColumn(null);

                setSortDirection("asc");

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

                    setRows(
                        response.data
                    );

                } else if (
                    response.success &&
                    !response.data?.length
                ) {

                    setRows([]);

                    setEmpty(true);

                } else {

                    setRows([]);

                    setError(
                        response.message ||
                        "Failed to load table."
                    );

                }

            } catch (error) {

                console.error(
                    "Failed to load table:",
                    error
                );

                setRows([]);

                setError(
                    "Failed to load table."
                );

            } finally {

                setLoading(false);

            }

        };

        loadTable();

    }, [
        request,
        filters,
        filterDefinitions,
        refreshKey,
    ]);

    /*
     * Handle column sorting.
     */
    const handleSort = (
        column: string
    ) => {

        if (
            sortColumn === column
        ) {

            setSortDirection(
                previous =>
                    previous === "asc"
                        ? "desc"
                        : "asc"
            );

        } else {

            setSortColumn(column);

            setSortDirection("asc");

        }

        setCurrentPage(1);

    };

    /*
     * Sort rows.
     */
    const sortedRows =
        [...rows].sort(
            (a, b) => {

                if (!sortColumn) {
                    return 0;
                }

                const valueA =
                    a[sortColumn];

                const valueB =
                    b[sortColumn];

                /*
                 * Empty values go to
                 * the bottom.
                 */
                if (
                    valueA === null ||
                    valueA === undefined ||
                    valueA === ""
                ) {

                    return 1;

                }

                if (
                    valueB === null ||
                    valueB === undefined ||
                    valueB === ""
                ) {

                    return -1;

                }

                /*
                 * Numeric sorting.
                 */
                const numberA =
                    Number(valueA);

                const numberB =
                    Number(valueB);

                const bothNumbers =
                    !Number.isNaN(
                        numberA
                    ) &&
                    !Number.isNaN(
                        numberB
                    );

                const comparison =
                    bothNumbers
                        ? numberA - numberB
                        :
                        String(valueA)
                            .localeCompare(
                                String(valueB),
                                undefined,
                                {
                                    numeric: true,
                                    sensitivity:
                                        "base",
                                }
                            );

                return sortDirection ===
                    "asc"
                    ? comparison
                    : -comparison;

            }
        );

    /*
     * Pagination
     */
    const totalRows =
        sortedRows.length;

    const totalPages =
        Math.ceil(
            totalRows / pageSize
        );

    const startIndex =
        (currentPage - 1) *
        pageSize;

    const endIndex =
        startIndex + pageSize;

    const paginatedRows =
        sortedRows.slice(
            startIndex,
            endIndex
        );

    /*
     * Loading state
     */
    if (loading) {

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >

                <h2>
                    {title}
                </h2>

                {description && (
                    <div
                        style={{
                            fontSize: "12px",
                            opacity: 0.6,
                            marginBottom: "10px",
                        }}
                    >
                        {description}
                    </div>
                )}

                <div>
                    Loading...
                </div>

            </div>
        );

    }

    /*
     * Error state
     */
    if (error) {

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >

                <h2>
                    {title}
                </h2>

                {description && (
                    <div
                        style={{
                            fontSize: "12px",
                            opacity: 0.6,
                            marginBottom: "10px",
                        }}
                    >
                        {description}
                    </div>
                )}

                <div
                    style={{
                        color: "red",
                        marginTop: "10px",
                    }}
                >

                    <strong>
                        Failed to load table
                    </strong>

                    <div
                        style={{
                            fontSize: "12px",
                            marginTop: "5px",
                        }}
                    >
                        {error}
                    </div>

                </div>

            </div>
        );

    }

    /*
     * Empty state
     */
    if (empty) {

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >

                <h2>
                    {title}
                </h2>

                {description && (
                    <div
                        style={{
                            fontSize: "12px",
                            opacity: 0.6,
                            marginBottom: "10px",
                        }}
                    >
                        {description}
                    </div>
                )}

                <div
                    style={{
                        padding: "20px",
                        textAlign: "center",
                        opacity: 0.7,
                    }}
                >
                    No Data
                </div>

            </div>
        );

    }

    const columns =
        rows.length > 0
            ? Object.keys(rows[0])
            : [];

    const visibleStart =
        totalRows === 0
            ? 0
            : startIndex + 1;

    const visibleEnd =
        Math.min(
            endIndex,
            totalRows
        );

    /*
     * Pagination controls
     */
    const goToPreviousPage = () => {

        setCurrentPage(
            previous =>
                Math.max(
                    1,
                    previous - 1
                )
        );

    };

    const goToNextPage = () => {

        setCurrentPage(
            previous =>
                Math.min(
                    totalPages,
                    previous + 1
                )
        );

    };

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                overflow: "auto",
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
                        marginBottom: "10px",
                    }}
                >
                    {description}
                </div>
            )}

<div
    style={{
        width: "100%",
        overflowX: "auto",
    }}
>
    <table
        style={{
            width: "100%",
            minWidth: "600px",
            borderCollapse: "collapse",
            fontSize: "14px",
        }}
    >

        <thead>

            <tr>

                {columns.map(
                    column => (

                        <th
                            key={column}
                            onClick={() =>
                                handleSort(
                                    column
                                )
                            }
                            style={{
                                textAlign: "left",

                                padding: "10px",

                                borderBottom:
                                    "2px solid #ddd",

                                whiteSpace:
                                    "nowrap",

                                cursor:
                                    "pointer",

                                userSelect:
                                    "none",

                                minWidth: "120px",

                                position:
                                    "sticky",

                                top: 0,
                            }}
                        >

                            {column}

                            {sortColumn ===
                                column && (
                                <span
                                    style={{
                                        marginLeft:
                                            "6px",
                                    }}
                                >
                                    {sortDirection ===
                                    "asc"
                                        ? "↑"
                                        : "↓"}
                                </span>
                            )}

                        </th>

                    )
                )}

            </tr>

        </thead>

        <tbody>

            {paginatedRows.map(
                (
                    row,
                    rowIndex
                ) => (

                    <tr
                        key={
                            startIndex +
                            rowIndex
                        }
                    >

                        {columns.map(
                            column => (

                                <td
                                    key={
                                        column
                                    }
                                    style={{
                                        padding:
                                            "10px",

                                        borderBottom:
                                            "1px solid #eee",

                                        maxWidth:
                                            "300px",

                                        whiteSpace:
                                            "nowrap",

                                        overflow:
                                            "hidden",

                                        textOverflow:
                                            "ellipsis",
                                    }}
                                    title={String(
                                        row[
                                            column
                                        ] ?? ""
                                    )}
                                >
                                    {String(
                                        row[
                                            column
                                        ] ?? ""
                                    )}
                                </td>

                            )
                        )}

                    </tr>

                )
            )}

        </tbody>

    </table>
</div>

            {totalPages > 1 && (

                <div
                    style={{
                        display: "flex",
                        alignItems:
                            "center",
                        justifyContent:
                            "space-between",
                        gap: "10px",
                        marginTop: "12px",
                        paddingTop: "10px",
                        borderTop:
                            "1px solid #eee",
                    }}
                >

                    <div
                        style={{
                            fontSize: "12px",
                            opacity: 0.7,
                        }}
                    >
                        Showing{" "}
                        {visibleStart}
                        {" - "}
                        {visibleEnd}
                        {" of "}
                        {totalRows}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems:
                                "center",
                            gap: "8px",
                        }}
                    >

                        <button
                            onClick={
                                goToPreviousPage
                            }
                            disabled={
                                currentPage ===
                                1
                            }
                        >
                            Previous
                        </button>

                        <span
                            style={{
                                fontSize: "12px",
                            }}
                        >
                            Page{" "}
                            {currentPage}
                            {" of "}
                            {totalPages}
                        </span>

                        <button
                            onClick={
                                goToNextPage
                            }
                            disabled={
                                currentPage ===
                                totalPages
                            }
                        >
                            Next
                        </button>

                    </div>

                </div>

            )}

        </div>
    );
}
