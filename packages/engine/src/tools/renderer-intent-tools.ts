import type {
    RendererConfig,
    RendererLedgerEventV1
} from "../contracts/renderer-intent.v1";
import { RendererHUD } from "../renderer/hud";
import { buildMaterialMap } from "../renderer/material-mapper";
import { RenderLoop } from "../renderer/render-loop";
import { buildThreeScene } from "../renderer/scene-builder";

export type ToolResult = {
  output: any;
  ledger_event?: RendererLedgerEventV1;
};

/**
 * Three.js Renderer Toolkit: integrate RenderPackets into Three.js
 */
export class RendererIntentToolkit {
  private THREE: any = null;
  private renderLoop: RenderLoop | null = null;
  private hud: RendererHUD | null = null;
  private currentScene: any = null;
  private currentCamera: any = null;

  constructor() {
    if (typeof window !== "undefined" && (window as any).THREE) {
      this.THREE = (window as any).THREE;
    } else {
      try {
        this.THREE = require("three");
      } catch {
        throw new Error("Three.js must be available (window.THREE or require('three'))");
      }
    }
  }

  initialize(config: RendererConfig): {
    success: boolean;
    message?: string;
    ledger?: RendererLedgerEventV1;
  } {
    // Initialize render loop
    this.renderLoop = new RenderLoop(this.THREE);
    const initResult = this.renderLoop.initialize(config);
    if (!initResult.success) {
      return { success: false, message: initResult.message };
    }

    // Initialize HUD
    this.hud = new RendererHUD();
    this.hud.create(config.canvas_id);

    return {
      success: true,
      message: "Renderer initialized",
      ledger: {
        type: "renderer.initialized.v1",
        time_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        actor_id: "system",
        request_id: "init-1",
        canvas_id: config.canvas_id,
        width_px: config.width_px,
        height_px: config.height_px,
      },
    };
  }

  renderPacket(sceneBody: any, matsBody: any, vpBody: any, commands: any[]): ToolResult {
    if (!this.renderLoop || !this.hud) {
      return {
        output: { success: false, message: "Renderer not initialized", rendered_command_count: 0 },
      };
    }

    try {
      const startTime = performance.now();

      // Build material map
      const materialMap = buildMaterialMap(matsBody.materials);

      // Build Three.js scene
      const { scene, rootObjects } = buildThreeScene(
        sceneBody.scene.nodes,
        sceneBody.scene.root_nodes,
        materialMap
      );

      // Find camera
      const cameraNode = sceneBody.scene.nodes.find(
        (n: any) => n.kind === "camera"
      );
      if (!cameraNode) {
        throw new Error("No camera found in scene");
      }

      // Build camera object
      let camera: any;
      if (cameraNode.camera.kind === "perspective") {
        camera = new this.THREE.PerspectiveCamera(
          cameraNode.camera.fov_deg ?? 60,
          vpBody.viewport.width_px / vpBody.viewport.height_px,
          cameraNode.camera.near ?? 0.1,
          cameraNode.camera.far ?? 1000
        );
      } else {
        const aspect = vpBody.viewport.width_px / vpBody.viewport.height_px;
        const h = 10;
        const w = h * aspect;
        camera = new this.THREE.OrthographicCamera(-w, w, h, -h, 0.1, 1000);
      }

      camera.position.set(
        cameraNode.transform.t.x,
        cameraNode.transform.t.y,
        cameraNode.transform.t.z
      );
      camera.quaternion.set(
        cameraNode.transform.r.x,
        cameraNode.transform.r.y,
        cameraNode.transform.r.z,
        cameraNode.transform.r.w
      );

      scene.add(camera);

      this.currentScene = scene;
      this.currentCamera = camera;
      this.renderLoop.setScene(scene, camera);

      // Render
      const { frameTime, fps } = this.renderLoop.render();

      // Update HUD
      const renderHash = commands[0]?.cmd_id?.split(":")?.[2] ?? "unknown";
      this.hud.setRenderPacketHash(renderHash);
      this.hud.setFrameStats(frameTime, fps, commands.length);

      return {
        output: {
          success: true,
          rendered_command_count: commands.length,
          frame_time_ms: frameTime,
          render_packet_hash: renderHash,
        },
        ledger_event: {
          type: "renderer.rendered.v1",
          time_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
          actor_id: "renderer",
          request_id: "render-1",
          render_packet_id: "rnd:packet:unknown",
          render_packet_hash: renderHash,
          command_count: commands.length,
          frame_time_ms: frameTime,
        },
      };
    } catch (e) {
      const errorMsg = String(e);
      this.hud.setErrorMessage(errorMsg);
      return {
        output: {
          success: false,
          message: errorMsg,
          rendered_command_count: 0,
        },
        ledger_event: {
          type: "renderer.error.v1",
          time_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
          actor_id: "renderer",
          request_id: "render-1",
          error_message: errorMsg,
        },
      };
    }
  }

  dispose(): void {
    if (this.renderLoop) {
      this.renderLoop.dispose();
      this.renderLoop = null;
    }
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
  }
}
