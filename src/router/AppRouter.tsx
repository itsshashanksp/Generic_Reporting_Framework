import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import Layout from "../components/Layout/Layout";

import Dashboard from "../pages/Dashboard";
import ReportViewer from "../pages/ReportViewer";
import DashboardViewer from "../pages/DashboardViewer";
import menu from "../config/menu.json";
import { getDashboardIds } from "../engine/DashboardEngine";
import { getFirstDashboardRoute, loadNavigation } from "../engine/NavigationEngine";
import { getReportIds } from "../engine/ReportEngine/reportLoader";

const homeRoute = getFirstDashboardRoute(loadNavigation(menu, {
    reportIds: getReportIds(),
    dashboardIds: getDashboardIds(),
}));

export default function AppRouter() {

    return (

        <BrowserRouter>

            <Routes>

                <Route element={<Layout />}>

                    <Route
                        path="/"
                        element={homeRoute
                            ? <Navigate to={homeRoute} replace />
                            : <Dashboard dashboardId="item-dashboard" />}
                    />

                    <Route
                        path="/dashboard/:dashboardId"
                        element={<DashboardViewer />}
                    />

                    <Route
                        path="/report/:reportId"
                        element={<ReportViewer />}
                    />

                </Route>

            </Routes>

        </BrowserRouter>

    );

}
