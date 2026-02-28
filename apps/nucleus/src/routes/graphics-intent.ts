/**
 * Nucleus wiring (tool handlers).
 *
 * This file avoids assumptions about your HTTP framework.
 * It exports a "register" function: you plug it into your existing tool registry.
 */

import { GraphicsIntentToolkit } from "@world-engine/engine";

// Minimal shape: adapt to your existing registry.
export type ToolHandler = (input: unknown) => Promise<{ output: unknown }>;
export type ToolRegistry = { register: (toolName: string, handler: ToolHandler) => void };

// Minimal shape: adapt to your existing ledger append.
export type LedgerAppender = (event: unknown) => Promise<void>;

export function registerGraphicsIntentTools(registry: ToolRegistry, ledgerAppend: LedgerAppender) {
  const kit = new GraphicsIntentToolkit();

  registry.register("scene.compose", async (input) => {
    const r = kit.scene_compose(input as any);
    await ledgerAppend(r.ledger_event);
    return { output: r.output };
  });

  registry.register("material.bind", async (input) => {
    const r = kit.material_bind(input as any);
    await ledgerAppend(r.ledger_event);
    return { output: r.output };
  });

  registry.register("viewport.define", async (input) => {
    const r = kit.viewport_define(input as any);
    await ledgerAppend(r.ledger_event);
    return { output: r.output };
  });

  registry.register("viewport.render", async (input) => {
    const r = kit.viewport_render(input as any);
    await ledgerAppend(r.ledger_event);
    return { output: r.output };
  });
}
