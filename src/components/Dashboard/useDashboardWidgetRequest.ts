import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    executeRequest,
    getRequestErrorMessage,
    isRequestAbort,
} from "../../api/request";
import { useDashboard } from "../../engine/DashboardContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";
import {
    createRequestCacheKey,
    getCachedResponse,
    getOrCreateInFlightRequest,
    setCachedResponse,
} from "../../engine/RequestCache";
import type { ApiResponse } from "../../types/api";
import type { FilterDefinition } from "../../types/filter";

interface RequestWithWhere {
    where?: unknown[];
}

interface WidgetRequestState {
    queryKey: string;
    response: ApiResponse | null;
    error: string | null;
    loading: boolean;
}

export function useDashboardWidgetRequest(
    request: (object & RequestWithWhere) | null,
    filterDefinitions: FilterDefinition[],
    cacheScope = "dashboard-widget"
) {
    const { refreshKey, appliedFilters } = useDashboard();
    const [retryKey, setRetryKey] = useState(0);
    const requestSequence = useRef(0);
    const previousRefreshKey = useRef(refreshKey);
    const previousRetryKey = useRef(retryKey);

    const dashboardWhere = useMemo(
        () => buildWhere(appliedFilters, filterDefinitions),
        [appliedFilters, filterDefinitions]
    );
    const queryKey = useMemo(
        () => JSON.stringify({ request, dashboardWhere }),
        [request, dashboardWhere]
    );
    const requestPayload = useMemo(() => request ? ({
        ...request,
        where: [
            ...(Array.isArray(request.where) ? request.where : []),
            ...dashboardWhere,
        ],
    }) : null, [request, dashboardWhere]);
    const cacheKey = useMemo(
        () => requestPayload
            ? createRequestCacheKey(`dashboard:${cacheScope}`, requestPayload)
            : "",
        [cacheScope, requestPayload]
    );
    const [state, setState] = useState<WidgetRequestState>({
        queryKey: "",
        response: null,
        error: null,
        loading: request !== null,
    });

    useEffect(() => {
        if (!request) {
            return;
        }

        const forceRefresh = previousRefreshKey.current !== refreshKey
            || previousRetryKey.current !== retryKey;
        previousRefreshKey.current = refreshKey;
        previousRetryKey.current = retryKey;

        const controller = new AbortController();
        const sequence = ++requestSequence.current;

        const load = async () => {
            if (!forceRefresh) {
                const cachedResponse = getCachedResponse(cacheKey);
                if (cachedResponse) {
                    setState({
                        queryKey,
                        response: cachedResponse,
                        error: null,
                        loading: false,
                    });
                    return;
                }
            }

            setState(previous => ({
                queryKey,
                response: previous.queryKey === queryKey
                    ? previous.response
                    : null,
                error: null,
                loading: true,
            }));

            try {
                const response = await getOrCreateInFlightRequest(
                    cacheKey,
                    signal => executeRequest(requestPayload!, { signal }),
                    controller.signal
                );

                if (sequence !== requestSequence.current) {
                    return;
                }

                setState(previous => ({
                    queryKey,
                    response: response.success
                        ? response
                        : previous.queryKey === queryKey ? previous.response : null,
                    error: response.success
                        ? null
                        : response.message || "The API could not load this widget.",
                    loading: false,
                }));

                if (response.success) {
                    setCachedResponse(cacheKey, response);
                }
            } catch (error: unknown) {
                if (isRequestAbort(error) || sequence !== requestSequence.current) {
                    return;
                }

                setState(previous => ({
                    queryKey,
                    response: previous.queryKey === queryKey ? previous.response : null,
                    error: getRequestErrorMessage(error),
                    loading: false,
                }));
            }
        };

        void load();

        return () => controller.abort();
    }, [request, requestPayload, queryKey, cacheKey, refreshKey, retryKey]);

    const retry = useCallback(() => {
        setRetryKey(previous => previous + 1);
    }, []);
    const queryMatches = state.queryKey === queryKey;

    return {
        response: queryMatches ? state.response : null,
        error: queryMatches ? state.error : null,
        loading: !queryMatches || state.loading,
        retry,
    };
}
