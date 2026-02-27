/**
 * Histogram Renderer - Token frequency bar chart
 */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
export function buildHistogramBars(topTokens, maxBars = 12) {
    return topTokens
        .sort((a, b) => b.count - a.count)
        .slice(0, maxBars)
        .map((token) => ({
        label: token.token,
        count: token.count,
        width: token.count,
    }));
}
export function drawHistogram(fit, frame, bars) {
    const { ctx, w, h } = fit;
    ctx.clearRect(0, 0, w, h);
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, w, h);
    const margin = 50;
    const graphW = w - 2 * margin;
    const graphH = h - 2 * margin;
    const maxWidth = Math.max(...bars.map((b) => b.width), 1);
    const barHeight = graphH / (bars.length + 1);
    // Draw axes
    ctx.strokeStyle = "rgba(100, 255, 218, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + graphH);
    ctx.lineTo(margin + graphW, margin + graphH);
    ctx.stroke();
    // Draw bars
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar)
            continue;
        const y = margin + (i + 1) * barHeight - barHeight / 2;
        const barW = (bar.width / maxWidth) * graphW * 0.9;
        // Bar gradient
        const grd = ctx.createLinearGradient(margin, y, margin + barW, y);
        grd.addColorStop(0, "rgba(100, 255, 218, 0.2)");
        grd.addColorStop(0.5, "rgba(100, 255, 218, 0.5)");
        grd.addColorStop(1, "rgba(100, 255, 218, 0.8)");
        ctx.fillStyle = grd;
        ctx.fillRect(margin, y - barHeight * 0.3, barW, barHeight * 0.6);
        // Border
        ctx.strokeStyle = "rgba(100, 255, 218, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, y - barHeight * 0.3, barW, barHeight * 0.6);
        // Label
        ctx.save();
        ctx.fillStyle = "rgba(230, 241, 255, 0.7)";
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(bar.label, margin - 8, y);
        // Count
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(100, 255, 218, 0.8)";
        ctx.fillText(` ${bar.count}`, margin + barW + 6, y);
        ctx.restore();
    }
    // Title
    ctx.save();
    ctx.fillStyle = "rgba(100, 255, 218, 0.6)";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Top Token Frequencies", margin, margin - 15);
    ctx.restore();
}
