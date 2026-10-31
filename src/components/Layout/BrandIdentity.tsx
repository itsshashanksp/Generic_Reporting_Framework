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
            <strong>{branding.applicationName}</strong>
        </span>
    );
}
