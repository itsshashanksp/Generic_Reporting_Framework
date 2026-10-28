import { BrowserRouter, Navigate, Outlet, Routes, Route } from "react-router-dom";

import Layout from "../components/Layout/Layout";

import ReportViewer from "../pages/ReportViewer";
import DashboardViewer from "../pages/DashboardViewer";
import Login from "../pages/Login";
import UserManagement from "../pages/UserManagement";
import Settings from "../pages/Settings";
import ErrorState from "../components/Common/Error";
import ApplicationSkeleton from "../components/Common/ApplicationSkeleton";
import { getDashboardIds } from "../engine/DashboardEngine";
import { getFirstDashboardRoute, loadConfiguredNavigation } from "../engine/NavigationEngine";
import { getReportIds } from "../engine/ReportEngine/reportLoader";
import { useSetup } from "../setup";
import { useAuth } from "../auth";
import BrandIdentity from "../components/Layout/BrandIdentity";
import useDocumentTitle from "../components/Layout/useDocumentTitle";

const homeRoute = getFirstDashboardRoute(loadConfiguredNavigation({
    reportIds: getReportIds(),
    dashboardIds: getDashboardIds(),
}));

export default function AppRouter() {
    return (
        <BrowserRouter>
            <ApplicationRoutes />
        </BrowserRouter>
    );
}

export function ApplicationRoutes() {
    const { state, refresh } = useSetup();

    if (state.status === "loading") {
        return <ApplicationSkeleton label="Checking application setup…" />;
    }
    if (state.status === "error") {
        return (
            <div className="setup-page">
                <ErrorState
                    title="Unable to check application setup"
                    message={state.error}
                    onRetry={() => void refresh()}
                />
            </div>
        );
    }
    if (state.status === "required") {
        return (
            <Routes>
                <Route path="*" element={<SetupRequired />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/setup" element={<Navigate to="/" replace />} />
                <Route element={<Layout />}>
                    <Route
                        path="/"
                        element={homeRoute
                            ? <Navigate to={homeRoute} replace />
                            : <EmptyApplicationHome />}
                    />

                    <Route
                        path="/dashboard/:dashboardId"
                        element={<DashboardViewer />}
                    />

                    <Route
                        path="/report/:reportId"
                        element={<ReportViewer />}
                    />

                    <Route path="/settings" element={<Settings />} />

                    <Route element={<AdminRoute />}>
                        <Route path="/settings/users" element={<UserManagement />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

function EmptyApplicationHome() {
    useDocumentTitle();
    return <main className="dashboard"><ErrorState title="No dashboards configured" message="Copy or create local report, dashboard, widget, and menu configuration to activate this framework." /></main>;
}

function SetupRequired() {
    useDocumentTitle("Setup Required");
    return <main className="setup-page"><section className="setup-card" aria-labelledby="setup-required-title"><div className="setup-card__heading"><BrandIdentity className="setup-card__eyebrow application-brand" /><h1 id="setup-required-title">User setup is required.</h1><p>Please complete user setup in the Backend Admin Console.</p></div></section></main>;
}

function ProtectedRoute() {
    const { state } = useAuth();
    if (state.status === "loading") {
        return <ApplicationSkeleton label="Restoring your session…" />;
    }
    if (state.status === "unauthenticated") {
        return <Navigate to="/login" replace />;
    }
    if (!state.user.frontendAccess) {
        return <Navigate to="/login" replace />;
    }
    // A different user gets a fresh page tree with no previous user's state.
    return <Outlet key={state.user.username} />;
}

function LoginRoute() {
    const { state, logout } = useAuth();
    if (state.status === "loading") {
        return <ApplicationSkeleton label="Restoring your session…" />;
    }
    if (state.status === "authenticated" && !state.user.frontendAccess) {
        return <AccessUnavailable onLogout={() => void logout()} />;
    }
    return state.status === "authenticated" ? <Navigate to="/" replace /> : <Login />;
}

function AccessUnavailable({ onLogout }: { onLogout: () => void }) {
    useDocumentTitle("Access Unavailable");
    return <div className="setup-page"><section className="setup-card">
        <h1>Frontend access is not assigned</h1>
        <p>This identity may have backend access, but it cannot use this application.</p>
        <button className="app-button app-button--primary" type="button" onClick={onLogout}>Sign out</button>
    </section></div>;
}

function AdminRoute() {
    const { state } = useAuth();
    if (state.status !== "authenticated") {
        return <Navigate to="/login" replace />;
    }
    return state.user.frontendRole === "application-administrator" ? <Outlet /> : <Navigate to="/" replace />;
}
