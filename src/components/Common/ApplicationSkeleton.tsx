import Skeleton from "./Skeleton";

export default function ApplicationSkeleton({ label = "Loading application…" }: { label?: string }) {
    return (
        <div className="app-initialization" role="status" aria-live="polite" aria-label={label}>
            <span className="sr-only">{label}</span>
            <aside className="app-initialization__sidebar" aria-hidden="true">
                <span className="skeleton__shape app-initialization__brand" />
                {Array.from({ length: 6 }, (_, index) => <span key={index} className="skeleton__shape app-initialization__nav" />)}
            </aside>
            <main className="app-initialization__main" aria-hidden="true">
                <header className="app-initialization__header">
                    <span className="skeleton__shape" />
                    <span className="skeleton__shape" />
                </header>
                <section className="app-initialization__content">
                    <span className="skeleton__shape app-initialization__title" />
                    <span className="skeleton__shape app-initialization__subtitle" />
                    <div className="app-initialization__filters">
                        <span className="skeleton__shape" />
                        <span className="skeleton__shape" />
                    </div>
                    <div className="app-initialization__cards">
                        <Skeleton kind="stat" label="" />
                        <Skeleton kind="stat" label="" />
                        <Skeleton kind="chart" label="" />
                    </div>
                </section>
            </main>
        </div>
    );
}
