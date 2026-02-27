/**
 * Orbit Renderer - Token node network visualization
 */
import { mulberry32 } from "../core/seed";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
export function buildOrbitNodes(topTokens, w, h, sessionHash) {
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.35;
    const rng = mulberry32(sessionHash ^ 0x67626868);
    return topTokens
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        .map((token, i) => {
        const θ = (i / Math.max(topTokens.length, 1)) * Math.PI * 2 + rng() * 0.2;
        const r_inner = lerp(20, 60, clamp(token.count / 100, 0, 1));
        return {
            x: cx + Math.cos(θ) * R,
            y: cy + Math.sin(θ) * R,
            r: r_inner,
            label: token.token,
            count: token.count,
        };
    });
}
export function drawOrbit(fit, frame, nodes) {
    const { ctx, w, h } = fit;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    // background tint
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // center point
    ctx.save();
    ctx.fillStyle = "rgba(100, 255, 218, 0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // connections between nodes
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "rgba(100, 255, 218, 1)";
    for (let i = 0; i < nodes.length; i++) {
        const curr = nodes[i];
        const next = nodes[(i + 1) % nodes.length];
        if (curr && next) {
            ctx.beginPath();
            ctx.moveTo(curr.x, curr.y);
            ctx.lineTo(next.x, next.y);
            ctx.stroke();
        }
    }
    ctx.restore();
    // spokes to center
    ctx.save();
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.12 + frame.energySmooth * 0.08;
    ctx.strokeStyle = "rgba(100, 255, 218, 1)";
    for (const node of nodes) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
    }
    ctx.restore();
    // render nodes
    ctx.save();
    for (const node of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(frame.t * 1.8);
        const size = node.r * (0.8 + pulse * 0.4);
        const energy_mod = 1 + frame.energySmooth * 0.6;
        // halo
        ctx.fillStyle = `rgba(100, 255, 218, ${0.08 * frame.boost})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 1.8, 0, Math.PI * 2);
        ctx.fill();
        // core
        ctx.fillStyle = `rgba(100, 255, 218, ${0.25 * energy_mod})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();
        // stroke
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(100, 255, 218, ${0.5 * energy_mod})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
    // labels
    ctx.save();
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(230, 241, 255, 0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const node of nodes) {
        ctx.fillText(node.label, node.x, node.y + node.r + 16);
    }
    ctx.restore();
}
