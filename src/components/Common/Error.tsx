interface Props {
    message: string;
}

export default function Error({ message }: Props) {
    return (
        <div
            style={{
                padding: "40px",
                textAlign: "center",
                color: "red",
            }}
        >
            <h2>Report Failed</h2>

            <p>{message}</p>
        </div>
    );
}