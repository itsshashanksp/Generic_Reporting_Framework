import { useLayoutEffect } from "react";

import { APPLICATION_BRANDING, getApplicationPageTitle } from "../../config/branding";

export default function useDocumentTitle(pageTitle?: string | null) {
    useLayoutEffect(() => {
        document.title = getApplicationPageTitle(pageTitle);
        return () => {
            document.title = APPLICATION_BRANDING.browserTitle;
        };
    }, [pageTitle]);
}
