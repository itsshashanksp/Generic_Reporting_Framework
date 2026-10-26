import { getReport } from "../../engine/ReportEngine/reportLoader";
import type { FilterDefinition } from "../../types/filter";
import type { WidgetFilterFields } from "../../engine/DashboardEngine/filterFields";
import type { ReportDefinition } from "../../types/report";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import Loading from "../Common/Loading";
import ReportTableFrame from "../Grid/ReportTableFrame";
import ReportDataGrid from "./ReportDataGrid";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";
import WidgetFilterController, { type WidgetFilterControls } from "./WidgetFilterController";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];

interface ReportWidgetProps {
    reportId?: string;
    definition?: ReportDefinition;
    title: string;
    description?: string;
    filterDefinitions?: FilterDefinition[];
    /** Renames shared dashboard filter fields for this widget (see DashboardWidget). */
    filterFields?: WidgetFilterFields;
    cacheScope?: string;
    runtimeFilters?: FilterDefinition[];
}

export default function ReportWidget({
    runtimeFilters = EMPTY_FILTER_DEFINITIONS,
    ...props
}: ReportWidgetProps) {
    const report = props.definition ?? (props.reportId ? getReport(props.reportId) : undefined) ?? null;
    return (
        <WidgetFilterController filters={runtimeFilters} database={report?.request.database} widgetTitle={props.title}>
            {controls => <ReportWidgetContent {...props} runtimeFilters={runtimeFilters} widgetFilterControls={controls} />}
        </WidgetFilterController>
    );
}

function ReportWidgetContent({
    reportId,
    definition,
    title,
    description,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    filterFields,
    cacheScope,
    runtimeFilters = EMPTY_FILTER_DEFINITIONS,
    widgetFilterControls,
}: ReportWidgetProps & { widgetFilterControls: WidgetFilterControls }) {
    const report = definition ?? (reportId ? getReport(reportId) : undefined) ?? null;
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        report?.request ?? null,
        filterDefinitions,
        cacheScope,
        filterFields,
        runtimeFilters,
        widgetFilterControls.appliedValues
    );
    const rows = response?.data ?? [];

    return (
        <ReportTableFrame
            className="dashboard-report"
            title={title}
            description={description}
            busy={loading}
            actions={<>
                {loading && rows.length > 0 && <span className="report-table-frame__status" role="status">Refreshing…</span>}
                {widgetFilterControls.button}
            </>}
        >
            {widgetFilterControls.panel}
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
                <ReportDataGrid
                    rows={rows}
                    columns={report.columns}
                    gridConfig={report.grid}
                    initialSort={report.sort}
                />
            )}
        </ReportTableFrame>
    );
}
