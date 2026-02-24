import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Rect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function rectFrom(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
  };
}

function sameRect(a: Rect | null, b: Rect): boolean {
  if (!a) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left
  );
}

/**
 * useMeasure<T>()
 * - Returns a ref callback + latest bounding rect
 * - Uses ResizeObserver when available
 * - Avoids redundant state updates via shallow rect equality
 */
export function useMeasure<T extends Element>(): [
  (node: T | null) => void,
  Rect | null
] {
  const [node, setNode] = useState<T | null>(null);
  const nodeRef = useRef<T | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const ref = useCallback((el: T | null) => {
    nodeRef.current = el;
    setNode(el);
  }, []);

  const measure = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const next = rectFrom(el);
    setRect((prev) => (sameRect(prev, next) ? prev : next));
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!node) return;

    // Initial measure (on mount / node attach)
    measure();

    // Prefer ResizeObserver (tracks element box changes)
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        // Keep it cheap: measure in the same tick
        measure();
      });
      ro.observe(node);
      return () => ro.disconnect();
    }

    // Fallback: window resize
    const onResize = () => measure();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [node, measure]);

  return [ref, rect];
}
