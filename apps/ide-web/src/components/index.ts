/**
 * IDE Components Export Barrel
 *
 * Core Components:
 * - ChatStreamDemo: P0 stream consumer UI
 * - AxisCodexSimDemo: Simulation control + visualization
 * - AxisCodexSimCanvas: Canvas renderer (graph + stimulus)
 * - AxisCodexSimMeters: Live gauges (fill, resonance, coherence)
 *
 * Integration:
 * - ConfigEditorForm: Interactive sliders for Heart params
 * - StreamingSimIntegratedDemo: P0 stream → stimulus → simulation in real-time
 */

export { ChatStreamDemo } from "./ChatStreamDemo";
export type { ChatStreamDemoProps } from "./ChatStreamDemo";

export { AxisCodexSimDemo } from "./AxisCodexSimDemo";
export type { AxisCodexSimDemoProps } from "./AxisCodexSimDemo";

export { AxisCodexSimCanvas, AxisCodexSimMeters } from "./AxisCodexSimCanvas";
export type { AxisCodexSimCanvasProps, AxisCodexSimMetersProps } from "./AxisCodexSimCanvas";

export { ConfigEditorForm } from "./ConfigEditorForm";
export type { ConfigEditorFormProps } from "./ConfigEditorForm";

export { StreamingSimIntegratedDemo } from "./StreamingSimIntegratedDemo";
