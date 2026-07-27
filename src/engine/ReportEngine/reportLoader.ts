import customerReport from "../../config/reports/customer.json";

const reports = {
    customer_report: customerReport,
};

export function getReport(reportId: string) {
    return reports[reportId as keyof typeof reports];
}