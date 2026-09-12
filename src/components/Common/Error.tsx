interface Props {
    message: string;
    title?: string;
    compact?: boolean;
    onRetry?: () => void;
}


export default function Error({
    message,
    title = "Unable to load report data",
    compact = false,
    onRetry,
}: Props) {
    return (
        <div
            className={`ui-state ui-state--error${compact ? " ui-state--compact" : ""}`}
            role="alert"
        >
            <h2>{title}</h2>
            <p>{message}</p>
            {onRetry && (
                <button type="button" className="app-button ui-state__action" onClick={onRetry}>
                    Try again
                </button>
            )}
        </div>
    );
}
