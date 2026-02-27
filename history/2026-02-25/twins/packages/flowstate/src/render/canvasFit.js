/**
 * Canvas Fit - Responsive crisp canvas rendering
 * Handles device pixel ratio scaling + resize
 */
export function fitCanvasToElement(el, canvas) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = el.getBoundingClientRect();
    const width = Math.max(1, Math.floor(r.width * dpr));
    const height = Math.max(1, Math.floor(r.height * dpr));
    if (canvas.width !== width)
        canvas.width = width;
    if (canvas.height !== height)
        canvas.height = height;
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("Canvas 2D context unavailable");
    // Use device pixels, but draw in CSS pixel coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height, dpr };
}
