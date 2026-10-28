import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastRecord {
    id: number;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    notify: (type: ToastType, message: string) => number;
    dismiss: (id: number) => void;
}

let records: ToastRecord[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function emit() {
    listeners.forEach(listener => listener());
}

function notify(type: ToastType, message: string) {
    const duplicate = records.find(record => record.type === type && record.message === message);
    if (duplicate) return duplicate.id;
    const record = { id: nextId++, type, message };
    records = [...records, record];
    emit();
    return record.id;
}

function dismiss(id: number) {
    const next = records.filter(record => record.id !== id);
    if (next.length === records.length) return;
    records = next;
    emit();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return records;
}

function ToastViewport() {
    const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        const timers = toasts.map(toast => window.setTimeout(
            () => dismiss(toast.id),
            toast.type === "error" ? 8000 : toast.type === "warning" ? 6000 : 4000,
        ));
        return () => timers.forEach(timer => window.clearTimeout(timer));
    }, [toasts]);

    if (!toasts.length) return null;
    return createPortal(
        <div className="toast-viewport" aria-label="Notifications">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`app-toast app-toast--${toast.type}`}
                    role={toast.type === "error" ? "alert" : "status"}
                    aria-live={toast.type === "error" ? "assertive" : "polite"}
                >
                    <span>{toast.message}</span>
                    <button type="button" aria-label={`Dismiss ${toast.message}`} onClick={() => dismiss(toast.id)}>×</button>
                </div>
            ))}
        </div>,
        document.body,
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const value = useMemo<ToastContextValue>(() => ({ notify, dismiss }), []);
    useEffect(() => () => {
        records = [];
        emit();
    }, []);
    return <ToastContext.Provider value={value}>{children}<ToastViewport /></ToastContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
    const value = useContext(ToastContext);
    return value ?? { notify: () => 0, dismiss: () => undefined };
}

