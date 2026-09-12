import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
    const location = useLocation();

    return (

        <div className="app-shell">

            <Sidebar />

            <div className="app-main">
                <div key={location.pathname} className="app-page-transition">
                    <Outlet />
                </div>
            </div>

        </div>

    );

}
