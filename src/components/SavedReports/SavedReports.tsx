import { useState } from "react";

import type { SavedReport } from "../../types/savedReport";

import {
    loadSavedReports,
    deleteSavedReport,
} from "../../engine/SavedReportEngine";

interface SavedReportsProps {
    reportId: string;

    onLoad: (
        report: SavedReport
    ) => void;
}

export default function SavedReports({
    reportId,
    onLoad,
}: SavedReportsProps) {

    const [reports, setReports] = useState<SavedReport[]>(
        () =>
            loadSavedReports().filter(
                report => report.reportId === reportId
            )
    );

    const handleDelete = (id: string) => {

        deleteSavedReport(id);

        setReports(
            loadSavedReports().filter(
                report => report.reportId === reportId
            )
        );
    };

    if (reports.length === 0) {
        return (
            <div
                style={{
                    marginTop: "20px",
                }}
            >
                <strong>Saved Reports</strong>

                <p>
                    No saved reports found.
                </p>
            </div>
        );
    }

    return (
        <div
            style={{
                marginTop: "20px",
            }}
        >

            <h3>Saved Reports</h3>

            {reports.map(report => (

                <div
                    key={report.id}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px",
                        marginBottom: "8px",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                    }}
                >

                    <div>

                        <strong>
                            {report.name}
                        </strong>

                        <div
                            style={{
                                fontSize: "12px",
                                opacity: 0.7,
                            }}
                        >
                            Updated:{" "}
                            {new Date(
                                report.updatedAt
                            ).toLocaleString()}
                        </div>

                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                        }}
                    >

                        <button
                            onClick={() =>
                                onLoad(report)
                            }
                        >
                            Load
                        </button>

                        <button
                            onClick={() =>
                                handleDelete(report.id)
                            }
                        >
                            Delete
                        </button>

                    </div>

                </div>

            ))}

        </div>
    );
}