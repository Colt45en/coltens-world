/**
 * Heatmap Renderer - Token frequency 2D heatmap visualization
 */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
export function buildHeatmapGrid(topTokens, maxCount, cols = 6) {
    const cells = [];
    const sorted = [...topTokens].sort((a, b) => b.count - a.count).slice(0, cols * cols);
    for (let i = 0; i < sorted.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const token = sorted[i];
        if (!token)
            continue;
        cells.push({
            x: col,
            y: row,
            w: 1,
            h: 1,
            value: clamp(token.count / maxCount, 0, 1),
            label: token.token,
        });
    }
    return cells;
}
export function drawHeatmap(fit, frame, cells, cols = 6) {
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, w, h);
    const margin = 40;
    const gridW = w - 2 * margin;
    const gridH = h - 2 * margin;
    const rows = Math.ceil(cells.length / cols);
    const cellW = gridW / cols;
    const cellH = gridH / Math.max(rows, 1);
    // Draw grid
    for (const cell of cells) {
        const x = margin + cell.x * cellW;
        const y = margin + cell.y * cellH;
        // Heatmap color (blue → cyan → green → yellow → red)
        const hue = (1 - cell.value) * 240; // 240 (blue) → 0 (red)
        const brightness = 50 + cell.value * 50;
        const saturation = 70 + cell.value * 30;
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${brightness}%)`;
        ctx.fillRect(x, y, cellW - 2, cellH - 2);
        // Border
        ctx.strokeStyle = `rgba(100, 255, 218, ${0.2 + cell.value * 0.5})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellW - 2, cellH - 2);
        // Label + count
        ctx.save();
        ctx.fillStyle = `rgba(230, 241, 255, ${0.6 + cell.value * 0.4})`;
        ctx.font = `${Math.max(8, cellW * 0.15)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cell.label, x + cellW / 2, y + cellH / 2 - 6);
        ctx.font = `${Math.max(7, cellW * 0.12)}px monospace`;
        ctx.fillText(`${Math.round(cell.value * 100)}%`, x + cellW / 2, y + cellH / 2 + 6);
        ctx.restore();
    }
    // Title
    ctx.save();
    ctx.fillStyle = "rgba(100, 255, 218, 0.6)";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Token Frequency Heatmap", margin, margin - 10);
    ctx.restore();
    // Legend
    ctx.save();
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(100, 255, 218, 0.4)";
    ctx.textAlign = "right";
    ctx.fillText("Low  [0% ███████ 100%] High", w - margin, margin - 10);
    ctx.restore();
}
