import { APPLICATION_BRANDING, type ApplicationBranding } from "../../config/branding";

export default function BrandIdentity({
    className,
    branding = APPLICATION_BRANDING,
}: {
    className?: string;
    branding?: Readonly<ApplicationBranding>;
}) {
    return (
        <span className={className}>
            {branding.logoUrl && (
                <img
                    className="application-brand-logo"
                    src={branding.logoUrl}
                    alt={`${branding.applicationName} logo`}
                />
            )}
            <strong>{branding.applicationName}</strong>
        </span>
    );
}
