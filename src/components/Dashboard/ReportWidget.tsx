import { getReport } from "../../engine/ReportEngine/reportLoader";
import type { FilterDefinition } from "../../types/filter";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import Loading from "../Common/Loading";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import ReportDataGrid from "./ReportDataGrid";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];

interface ReportWidgetProps {
    reportId: string;
    title: string;
    description?: string;
    filterDefinitions?: FilterDefinition[];
    cacheScope?: string;
}

export default function ReportWidget({
    reportId,
    title,
    description,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    cacheScope,
}: ReportWidgetProps) {
    const report = getReport(reportId) ?? null;
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        report?.request ?? null,
        filterDefinitions,
        cacheScope
    );
    const rows = response?.data ?? [];

    return (
        <DashboardWidgetFrame
            title={title}
            description={description}
            refreshing={loading && rows.length > 0}
        >
            {!report && (
                <ErrorState title="Report unavailable" message="The configured report was not found." compact />
            )}
            {report && loading && rows.length === 0 && (
                <Loading label="Loading report widget…" compact />
            )}
            {report && !loading && error && rows.length === 0 && (
                <ErrorState title="Unable to load report widget" message={error} onRetry={retry} compact />
            )}
            {report && !loading && error && rows.length > 0 && (
                <div className="dashboard-widget-inline-error" role="alert">
                    <span>Refresh failed.</span>
                    <button type="button" className="app-button" onClick={retry}>Retry</button>
                </div>
            )}
            {report && !loading && !error && rows.length === 0 && (
                <Empty title="No records found" message="The current filters returned no data." compact />
            )}
            {report && rows.length > 0 && (
                <div className="dashboard-widget-content__grid">
                    <ReportDataGrid rows={rows} columns={report.columns} gridConfig={report.grid} />
                </div>
            )}
        </DashboardWidgetFrame>
    );
}
