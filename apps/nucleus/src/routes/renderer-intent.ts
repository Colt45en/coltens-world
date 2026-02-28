/**
 * Nucleus integration for Three.js Renderer Intent.
 * Bridges RenderPackets with Three.js rendering.
 */

import type {
    RendererRequestV1
} from "@world-engine/engine/src/contracts/renderer-intent.v1";
import { RendererIntentToolkit } from "@world-engine/engine/src/tools/renderer-intent-tools";

export type ToolHandler = (input: unknown) => Promise<{ output: unknown }>;
export type ToolRegistry = { register: (toolName: string, handler: ToolHandler) => void };
export type LedgerAppender = (event: unknown) => Promise<void>;
export type SnapshotFetcher = (id: string) => Promise<any>;

/**
 * Register renderer tools into your Nucleus registry.
 * Requires snapshot fetcher to pull graphics-intent snapshots.
 */
export function registerRendererIntentTools(
  registry: ToolRegistry,
  ledgerAppend: LedgerAppender,
  snapshotFetcher: SnapshotFetcher
) {
  const kit = new RendererIntentToolkit();

  registry.register("renderer.initialize", async (input) => {
    const req = input as RendererRequestV1;
    if (!req.config) {
      return { output: { success: false, message: "No config provided" } };
    }
    const result = kit.initialize(req.config);
    if (result.ledger) {
      await ledgerAppend(result.ledger);
    }
    return {
      output: {
        request_id: req.request_id,
        success: result.success,
        action: "initialize",
        message: result.message,
      },
    };
  });

  registry.register("renderer.render_packet", async (input) => {
    const req = input as RendererRequestV1;
    if (!req.render_packet_id) {
      return {
        output: { success: false, message: "No render_packet_id provided", rendered_command_count: 0 },
      };
    }

    try {
      // Fetch render packet snapshot
      const packetSnap = await snapshotFetcher(req.render_packet_id);
      if (!packetSnap) {
        throw new Error(`Render packet not found: ${req.render_packet_id}`);
      }

      const packetBody = JSON.parse(packetSnap.canonical_json);

      // Fetch scene, materials, viewport snapshots
      const sceneSnap = await snapshotFetcher(packetBody.scene_snapshot_id);
      const matsSnap = await snapshotFetcher(packetBody.materials_snapshot_id);
      const vpSnap = await snapshotFetcher(packetBody.viewport_snapshot_id);

      const sceneBody = JSON.parse(sceneSnap.canonical_json);
      const matsBody = JSON.parse(matsSnap.canonical_json);
      const vpBody = JSON.parse(vpSnap.canonical_json);

      // Render
      const result = kit.renderPacket(sceneBody, matsBody, vpBody, packetBody.commands);

      if (result.ledger_event) {
        await ledgerAppend(result.ledger_event);
      }

      return {
        output: {
          request_id: req.request_id,
          success: result.output.success,
          action: "render",
          output: result.output,
          message: result.output.message,
        },
      };
    } catch (e) {
      const msg = String(e);
      await ledgerAppend({
        type: "renderer.error.v1",
        time_utc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        actor_id: req.actor_id,
        request_id: req.request_id,
        error_message: msg,
      });
      return {
        output: {
          request_id: req.request_id,
          success: false,
          action: "render",
          message: msg,
        },
      };
    }
  });
}

export { RendererIntentToolkit };
