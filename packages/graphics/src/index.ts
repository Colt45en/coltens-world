/**
 * Renderer bridge for graphics systems
 * Adapts engine state to Three.js or WebGL output
 */

export interface RenderCommand {
  type: string;
  data: unknown;
}

export interface GraphicsContext {
  canvas: HTMLCanvasElement;
  fps: number;
  frameTime: number;
  drawCalls: number;
}

export class RendererBridge {
  private context: GraphicsContext;
  private frameTime: number = 0;
  private frameCount: number = 0;
  private lastTime: number = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.context = {
      canvas,
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
    };
  }

  updateStats(drawCalls: number): void {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.frameTime = delta;
    this.frameCount++;

    if (this.frameCount % 60 === 0) {
      this.context.fps = Math.round(1000 / (this.frameTime / 60));
    }

    this.context.drawCalls = drawCalls;
    this.lastTime = now;
  }

  getStats() {
    return {
      fps: this.context.fps,
      frameTime: this.context.frameTime,
      drawCalls: this.context.drawCalls,
    };
  }

  getContext(): GraphicsContext {
    return this.context;
  }

  processCommand(command: RenderCommand): void {
    // Command processing will be implemented per renderer
    // This is a placeholder for the bridge interface
  }
}

// GPU-accelerated swarm system (100k+ agents)
export { NexusSwarmSystem, type NexusSwarmConfig } from "./nexus/NexusSwarmSystem";

export default RendererBridge;
