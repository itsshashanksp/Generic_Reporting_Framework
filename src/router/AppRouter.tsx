import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "../components/Layout/Layout";

import Dashboard from "../pages/Dashboard";
import ReportViewer from "../pages/ReportViewer";
import Settings from "../pages/Settings";
import DashboardViewer from "../pages/DashboardViewer";

export default function AppRouter() {

    return (

        <BrowserRouter>

            <Routes>

                <Route
                    path="/dashboard/:dashboardId"
                    element={<DashboardViewer />}
                />

                <Route element={<Layout />}>

                    <Route path="/" element={<Dashboard />} />

                    <Route
                        path="/report/:reportId"
                        element={<ReportViewer />}
                    />

                    <Route
                        path="/settings"
                        element={<Settings />}
                    />

                </Route>

            </Routes>

        </BrowserRouter>

    );

}