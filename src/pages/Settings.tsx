import { ArrowRight, Database, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { useAuth } from "../auth";
import { useOptionalGlobalDatabase } from "../engine/DatabaseContext";
import Skeleton from "../components/Common/Skeleton";
import useDocumentTitle from "../components/Layout/useDocumentTitle";
import { useToast } from "../components/Notifications/ToastProvider";

export default function Settings() {
    useDocumentTitle("Settings");
    const { state } = useAuth();
    const globalDatabase = useOptionalGlobalDatabase();
    const toast = useToast();
    const isAdmin = state.status === "authenticated" && state.user.frontendRole === "application-administrator";
    const [draft, setDraft] = useState<string | null>(null);
    const [pageSelectionDraft, setPageSelectionDraft] = useState<boolean | null>(null);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const savedDatabase = globalDatabase?.database ?? "";
    const selection = draft ?? savedDatabase;
    const pageSelection = pageSelectionDraft ?? globalDatabase?.pageDatabaseSelection ?? false;
    const hasChanges = draft !== null && draft !== savedDatabase
        || pageSelectionDraft !== null && pageSelectionDraft !== globalDatabase?.pageDatabaseSelection;

    const saveDatabase = async () => {
        if (!globalDatabase) return;
        setSaveState("saving");
        await Promise.resolve();
        const savedDatabaseSelection = globalDatabase.save(selection);
        const savedPageSelection = globalDatabase.savePageDatabaseSelection(pageSelection);
        const saved = savedDatabaseSelection && savedPageSelection;
        setSaveState(saved ? "saved" : "error");
        if (saved) {
            setDraft(null);
            setPageSelectionDraft(null);
            toast.notify("success", "Settings saved successfully.");
        } else {
            toast.notify("error", "Unable to save settings.");
        }
    };

    useEffect(() => {
        if (globalDatabase?.registry.status === "ready" && globalDatabase.configuredDatabase && !globalDatabase.database) {
            toast.notify("warning", "Your selected database is no longer available. The backend default will be used.");
        }
    }, [globalDatabase?.configuredDatabase, globalDatabase?.database, globalDatabase?.registry.status, toast]);

    return (
        <main className="settings-page">
            <header className="settings-header">
                <p className="settings-eyebrow">Application</p>
                <h1>Settings</h1>
                <p>Manage application configuration and administration.</p>
            </header>

            <section className="settings-grid" aria-label="Available settings">
                {globalDatabase && (
                    <article className="settings-option settings-option--database">
                        <div className="settings-option__icon"><Database aria-hidden="true" /></div>
                        <div className="settings-option__content">
                            <h2>Database Selection</h2>
                            <p>Set the frontend default used when a report, dashboard, or widget does not specify a database.</p>
                            {globalDatabase.registry.status === "loading" ? (
                                <div className="settings-database-form" aria-busy="true">
                                    <Skeleton kind="filter" label="Loading database settings…" />
                                    <Skeleton kind="text" label="Loading database setting details…" />
                                </div>
                            ) : globalDatabase.registry.status === "failed" ? (
                                <div role="alert">
                                    <p>{globalDatabase.registry.error}</p>
                                    <button type="button" className="app-button" onClick={globalDatabase.registry.retry}>Try again</button>
                                </div>
                            ) : (
                                <div className="settings-database-form">
                                    <label>
                                        <span>Default Database</span>
                                        <select value={selection} onChange={event => { setDraft(event.target.value); setSaveState("idle"); }}>
                                            <option value="">Use Backend Default</option>
                                            {globalDatabase.registry.options.map(option => (
                                                <option key={option.id} value={option.id} disabled={option.disabled}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="settings-database-form__help">
                                        This browser-local setting is the frontend default. Explicit JSON databases take precedence, and a page-level selector can override the effective default for that page.
                                    </p>
                                    <label>
                                        <span>Enable Page-Level Database Selection</span>
                                        <select
                                            value={pageSelection ? "on" : "off"}
                                            onChange={event => {
                                                setPageSelectionDraft(event.target.value === "on");
                                                setSaveState("idle");
                                            }}
                                        >
                                            <option value="on">ON</option>
                                            <option value="off">OFF</option>
                                        </select>
                                    </label>
                                    <p className="settings-database-form__help">
                                        This browser-local setting shows the existing authorized database selector on eligible reports and dashboards. It does not change the application default.
                                    </p>
                                    <div className="settings-option__action">
                                        <button
                                            type="button"
                                            className="app-button app-button--primary"
                                            onClick={() => void saveDatabase()}
                                            disabled={!hasChanges || saveState === "saving"}
                                        >
                                            {saveState === "saving" ? "Saving…" : "Save Changes"}
                                        </button>
                                        {hasChanges && saveState === "idle" && <p role="status">Unsaved changes</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </article>
                )}
                {isAdmin && (
                    <article className="settings-option settings-option--users">
                        <div className="settings-option__icon"><Users aria-hidden="true" /></div>
                        <div className="settings-option__content">
                            <h2>User Management</h2>
                            <p>Create and manage application users and administrator access.</p>
                            <div className="settings-option__action">
                                <Link className="settings-option__link" to="/settings/users">
                                    Open User Management <ArrowRight aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                    </article>
                )}
            </section>
            {!globalDatabase && !isAdmin && (
                <section className="settings-empty" aria-labelledby="settings-empty-title">
                    <h2 id="settings-empty-title">No settings are available for your account</h2>
                    <p>Additional settings will appear here when they are available to you.</p>
                </section>
            )}
        </main>
    );
}
