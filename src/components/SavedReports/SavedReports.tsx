import { useState } from "react";

import type { SavedReport } from "../../types/savedReport";

import {
    loadSavedReports,
    deleteSavedReport,
} from "../../engine/SavedReportEngine";


interface SavedReportsProps {
    reportId: string;

    /** Signed-in username that owns the saved views. */
    owner: string;

    onLoad: (
        report: SavedReport
    ) => void;
}

export default function SavedReports({
    reportId,
    owner,
    onLoad,
}: SavedReportsProps) {

    const [, setLocalRevision] = useState(0);
    const reports = loadSavedReports(owner).filter(report => report.reportId === reportId);

    const handleDelete = (id: string) => {

        deleteSavedReport(owner, id);

        setLocalRevision(previous => previous + 1);
    };

    if (reports.length === 0) {
        return (
            <section className="saved-reports">
                <strong>Saved Reports</strong>

                <p>
                    No saved reports found.
                </p>
            </section>
        );
    }

    return (
        <section className="saved-reports">

            <h3>Saved Reports</h3>

            {reports.map(report => (

                <article
                    key={report.id}
                    className="saved-reports__item"
                >

                    <div>

                        <strong>
                            {report.name}
                        </strong>

                        <div className="saved-reports__date">
                            Updated:{" "}
                            {new Date(
                                report.updatedAt
                            ).toLocaleString()}
                        </div>

                    </div>

                    <div className="saved-reports__actions">

                        <button
                            type="button"
                            className="app-button"
                            onClick={() =>
                                onLoad(report)
                            }
                        >
                            Load
                        </button>

                        <button
                            type="button"
                            className="app-button"
                            onClick={() =>
                                handleDelete(report.id)
                            }
                        >
                            Delete
                        </button>

                    </div>

                </article>

            ))}

        </section>
    );
}
