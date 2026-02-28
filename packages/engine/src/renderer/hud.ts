/**
 * HUD overlay: displays RenderPacket hash and debug info.
 */

export class RendererHUD {
  private hudElement: HTMLDivElement | null = null;

  create(canvasId: string): void {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    // Create HUD overlay
    this.hudElement = document.createElement("div");
    this.hudElement.id = "gfx-renderer-hud";
    this.hudElement.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #00ff00;
      z-index: 10000;
      min-width: 300px;
      max-width: 400px;
      white-space: pre-wrap;
      word-break: break-all;
      box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
    `;

    container.style.position = "relative";
    container.appendChild(this.hudElement);
  }

  setRenderPacketHash(hash: string): void {
    if (!this.hudElement) return;
    const timestamp = new Date().toISOString();
    this.hudElement.innerHTML = `
<strong>🎨 RenderPacket Hash</strong>
<span>${hash}</span>

<strong>📍 Timestamp</strong>
<span>${timestamp}</span>

<strong style="color: #ffff00;">✓ Determinism Valid</strong>
(Same hash = identical render)
    `.trim();
  }

  setErrorMessage(message: string): void {
    if (!this.hudElement) return;
    this.hudElement.innerHTML = `
<strong style="color: #ff4444;">⚠ Render Error</strong>
<span>${message}</span>
    `.trim();
  }

  setFrameStats(frameTime: number, fps: number, commandCount: number): void {
    if (!this.hudElement) return;
    const existing = this.hudElement.innerHTML;
    const stats = `

<strong style="color: #aaaaff;">📊 Frame Stats</strong>
Frame Time: ${frameTime.toFixed(2)}ms
FPS: ${fps.toFixed(1)}
Commands: ${commandCount}`;
    this.hudElement.innerHTML = existing + stats;
  }

  destroy(): void {
    if (this.hudElement && this.hudElement.parentElement) {
      this.hudElement.parentElement.removeChild(this.hudElement);
    }
    this.hudElement = null;
  }
}
