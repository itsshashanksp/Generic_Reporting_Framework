import { useEffect, useRef, useState, type RefObject } from "react";

const MOBILE_QUERY = "(max-width: 720px) and (pointer: coarse)";
const REFRESH_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 88;

interface PullToRefreshOptions {
    onRefresh: () => void;
    disabled?: boolean;
}

interface PullToRefreshResult {
    containerRef: RefObject<HTMLElement | null>;
    pullDistance: number;
    armed: boolean;
}

export default function usePullToRefresh({
    onRefresh,
    disabled = false,
}: PullToRefreshOptions): PullToRefreshResult {
    const containerRef = useRef<HTMLElement>(null);
    const gesture = useRef({ tracking: false, startX: 0, startY: 0, distance: 0 });
    const [pullDistance, setPullDistance] = useState(0);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const reset = () => {
            gesture.current.tracking = false;
            gesture.current.distance = 0;
            setPullDistance(0);
        };
        const isAtPageTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;
        const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches ?? false;

        const handleTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            const target = event.target as Element | null;
            if (
                disabled
                || event.touches.length !== 1
                || !touch
                || !isMobile()
                || !isAtPageTop()
                || target?.closest("button, input, select, textarea, a")
            ) {
                reset();
                return;
            }

            gesture.current = {
                tracking: true,
                startX: touch.clientX,
                startY: touch.clientY,
                distance: 0,
            };
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (!gesture.current.tracking) return;
            const touch = event.touches[0];
            if (!touch) return;

            const horizontalTravel = Math.abs(touch.clientX - gesture.current.startX);
            const verticalTravel = touch.clientY - gesture.current.startY;
            if (verticalTravel <= 0 || horizontalTravel > verticalTravel * 0.75 || !isAtPageTop()) {
                reset();
                return;
            }

            if (verticalTravel > 8 && event.cancelable) event.preventDefault();
            const distance = Math.min(MAX_PULL_DISTANCE, Math.max(0, (verticalTravel - 8) * 0.45));
            gesture.current.distance = distance;
            setPullDistance(distance);
        };

        const handleTouchEnd = () => {
            const shouldRefresh = gesture.current.tracking
                && gesture.current.distance >= REFRESH_THRESHOLD
                && !disabled;
            reset();
            if (shouldRefresh) onRefresh();
        };

        container.addEventListener("touchstart", handleTouchStart, { passive: true });
        container.addEventListener("touchmove", handleTouchMove, { passive: false });
        container.addEventListener("touchend", handleTouchEnd);
        container.addEventListener("touchcancel", reset);

        return () => {
            container.removeEventListener("touchstart", handleTouchStart);
            container.removeEventListener("touchmove", handleTouchMove);
            container.removeEventListener("touchend", handleTouchEnd);
            container.removeEventListener("touchcancel", reset);
        };
    }, [disabled, onRefresh]);

    return {
        containerRef,
        pullDistance,
        armed: pullDistance >= REFRESH_THRESHOLD,
    };
}
