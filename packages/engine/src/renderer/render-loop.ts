import type { RendererConfig } from "../contracts/renderer-intent.v1";

/**
 * Manages Three.js render loop, canvas setup, and frame timing.
 */

export class RenderLoop {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: any = null;
  private scene: any = null;
  private camera: any = null;
  private frameId: number | null = null;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fps = 0;

  private fpsBuffer: number[] = [];
  private fpsBufferSize = 30;

  constructor(private THREE: any) {}

  initialize(config: RendererConfig): { success: boolean; message?: string } {
    try {
      this.canvas = document.getElementById(config.canvas_id) as HTMLCanvasElement;
      if (!this.canvas) {
        return { success: false, message: `Canvas element not found: ${config.canvas_id}` };
      }

      this.renderer = new this.THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
      });
      this.renderer.setPixelRatio(config.pixel_ratio);
      this.renderer.setSize(config.width_px, config.height_px, false);
      this.renderer.setClearColor(config.background_color);
      this.renderer.sortObjects = false; // Respect our deterministic sorting

      return { success: true, message: "Renderer initialized" };
    } catch (e) {
      return { success: false, message: `Initialization error: ${String(e)}` };
    }
  }

  setScene(scene: any, camera: any): void {
    this.scene = scene;
    this.camera = camera;
  }

  render(): { frameTime: number; fps: number } {
    if (!this.renderer || !this.scene || !this.camera) {
      return { frameTime: 0, fps: 0 };
    }

    const startTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    const frameTime = performance.now() - startTime;

    this.frameCount++;
    this.fpsBuffer.push(1000 / frameTime);
    if (this.fpsBuffer.length > this.fpsBufferSize) {
      this.fpsBuffer.shift();
    }
    this.fps = this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length;

    return { frameTime, fps: this.fps };
  }

  getState() {
    return {
      frameCount: this.frameCount,
      fps: this.fps,
    };
  }

  dispose(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
