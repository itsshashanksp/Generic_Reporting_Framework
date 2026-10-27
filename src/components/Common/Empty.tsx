
interface EmptyProps {
    title?: string;
    message?: string;
    compact?: boolean;
}

export default function Empty({
    title = "No data available",
    message = "There is no data to display.",
    compact = false,
}: EmptyProps) {
    return (
        <div
            className={`ui-state${compact ? " ui-state--compact" : ""}`}
            role="status"
        >
            <h2>{title}</h2>
            <p>{message}</p>
        </div>
    );
}
