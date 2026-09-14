import { useEffect, useMemo, useState } from "react";

import { executeRequest, getRequestErrorMessage, isRequestAbort } from "../../api/request";
import {
    createRequestCacheKey,
    getCachedResponse,
    getOrCreateInFlightRequest,
    setCachedResponse,
} from "../../engine/RequestCache";
import type { DynamicFilterOptions, FilterOption } from "../../types/filter";

type ScalarOption = string | number | boolean;

export function useDynamicFilterOptions(configuration?: DynamicFilterOptions) {
    const cacheKey = useMemo(
        () => configuration
            ? createRequestCacheKey("dynamic-filter-options", configuration.request)
            : "",
        [configuration]
    );
    const [state, setState] = useState<{
        key: string;
        options: FilterOption[];
        loading: boolean;
        error: string;
    }>({ key: "", options: [], loading: false, error: "" });
    const cachedResponse = configuration ? getCachedResponse(cacheKey) : null;
    const cachedOptions = useMemo(
        () => cachedResponse && configuration
            ? mapOptions(cachedResponse.data, configuration)
            : null,
        [cachedResponse, configuration]
    );

    useEffect(() => {
        if (!configuration) return;
        if (cachedResponse) return;

        const controller = new AbortController();
        void getOrCreateInFlightRequest(
            cacheKey,
            signal => executeRequest(configuration.request, { signal }),
            controller.signal
        ).then(response => {
            setCachedResponse(cacheKey, response);
            setState({ key: cacheKey, options: mapOptions(response.data, configuration), loading: false, error: "" });
        }).catch(error => {
            if (isRequestAbort(error)) return;
            setState({ key: cacheKey, options: [], loading: false, error: getRequestErrorMessage(error, "Unable to load filter values.") });
        });

        return () => controller.abort();
    }, [cacheKey, cachedResponse, configuration]);

    if (cachedOptions) {
        return { options: cachedOptions, loading: false, error: "" };
    }

    return state.key === cacheKey
        ? state
        : { options: [], loading: Boolean(configuration), error: "" };
}

function mapOptions(
    rows: Record<string, unknown>[],
    configuration: DynamicFilterOptions
): FilterOption[] {
    const options = rows.flatMap(row => {
        const value = row[configuration.valueField];
        if (!isScalar(value)) return [];
        const labelValue = configuration.labelField ? row[configuration.labelField] : value;
        const rawCount = configuration.countField ? row[configuration.countField] : undefined;
        const count = typeof rawCount === "number"
            ? rawCount
            : typeof rawCount === "string" && rawCount.trim() !== "" && Number.isFinite(Number(rawCount))
                ? Number(rawCount)
                : undefined;
        return [{
            value,
            label: labelValue === null || labelValue === undefined ? String(value) : String(labelValue),
            ...(count !== undefined ? { count } : {}),
        }];
    });

    const unique = new Map<string, FilterOption>();
    options.forEach(option => unique.set(`${typeof option.value}:${String(option.value)}`, option));
    return [...unique.values()].sort((left, right) =>
        (right.count ?? 0) - (left.count ?? 0)
        || left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: "base" })
    );
}

function isScalar(value: unknown): value is ScalarOption {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
