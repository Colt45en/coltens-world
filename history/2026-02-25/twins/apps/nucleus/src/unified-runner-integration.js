/**
 * Integration: Unified Pipeline Runner → Nucleus Bus → IDE
 *
 * This is how Phase 5 works end-to-end:
 * 1. Unified runner processes input through stages
 * 2. Each stage emits a BusEnvelopeV1
 * 3. globalBus routes and caches envelopes
 * 4. HTTP replay endpoints provide historical access
 * 5. WS clients subscribe and receive real-time updates
 */
import { globalBus } from "./bus/busHub";
/**
 * Example: Unified runner emitting pipeline events to the bus
 */
export async function runUnifiedPipelineWithBus(input) {
    const { traceId, text, options = {} } = input;
    const stages = options.stages ?? [
        "prose.decompose",
        "prose.superpose",
        "prose.collapse",
        "prose.synthesize"
    ];
    console.log(`🚀 Starting pipeline run: ${traceId}`);
    const pipelineStartMs = Date.now();
    for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const startMs = Date.now();
        // Emit stage started
        const startEnv = {
            v: 1,
            id: `${traceId}-${stage}-start`,
            ts: new Date().toISOString(),
            type: "pipeline.stage.started",
            source: "tooling.unifiedRunner",
            traceId,
            spanId: `span-${i}`,
            severity: "info",
            data: {
                stage,
                index: i,
                total: stages.length
            }
        };
        globalBus.publish(startEnv);
        console.log(`  ▶ ${stage} started`);
        // Simulate stage work
        await delay(Math.random() * 500 + 200);
        const elapsedMs = Date.now() - startMs;
        // Emit stage completed
        const completeEnv = {
            v: 1,
            id: `${traceId}-${stage}-complete`,
            ts: new Date().toISOString(),
            type: "pipeline.stage.completed",
            source: "tooling.unifiedRunner",
            traceId,
            spanId: `span-${i}`,
            severity: "info",
            data: {
                stage,
                index: i,
                total: stages.length,
                ms: elapsedMs,
                output: `Output from ${stage}: processed "${text.slice(0, 30)}..."`
            }
        };
        globalBus.publish(completeEnv);
        console.log(`  ✓ ${stage} completed (${elapsedMs}ms)`);
    }
    // Emit run completed
    const runCompleteEnv = {
        v: 1,
        id: `${traceId}-run-complete`,
        ts: new Date().toISOString(),
        type: "pipeline.run.completed",
        source: "tooling.unifiedRunner",
        traceId,
        spanId: "span-final",
        severity: "info",
        data: {
            stagesRun: stages.length,
            totalMs: Date.now() - pipelineStartMs,
            success: true
        }
    };
    globalBus.publish(runCompleteEnv);
    console.log(`✅ Pipeline complete. Trace: ${traceId}`);
    // Show what was cached
    const cached = globalBus.getTraceEnvelopes(traceId);
    console.log(`📊 Bus cached ${cached.length} envelopes for replay`);
}
/**
 * Access cached envelopes for replay/analysis
 */
export function getTraceEnvelopes(traceId) {
    return globalBus.getTraceEnvelopes(traceId);
}
/**
 * Get last N envelopes (for tail queries)
 */
export function getTraceEnvelopesTail(traceId, limit) {
    return globalBus.getTraceEnvelopesTail(traceId, limit);
}
/**
 * Get current bus statistics
 */
export function getBusStats() {
    return globalBus.getStats();
}
// Helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// ============================================================================
// CLI Demo Mode (runnable with: tsx unified-runner-integration.ts)
// ============================================================================
if (import.meta.main) {
    console.log("Phase 5 Integration Test\n");
    console.log("Running unified pipeline with bus...\n");
    await runUnifiedPipelineWithBus({
        traceId: "demo-trace-001",
        text: "Transform this code snippet to handle async transformations deterministically",
        options: {
            stages: [
                "prose.decompose",
                "prose.superpose",
                "prose.collapse",
                "prose.synthesize",
                "code.decompose",
                "code.synthesize"
            ]
        }
    });
    console.log("\n" + "=".repeat(60));
    console.log("Access cached envelopes via HTTP:\n");
    console.log("✅ GET http://localhost:3000/bus/stats");
    console.log("✅ GET http://localhost:3000/bus/trace/demo-trace-001");
    console.log("✅ GET http://localhost:3000/bus/trace/demo-trace-001/tail?limit=5");
    console.log("✅ GET http://localhost:3000/bus/traces\n");
    console.log("or subscribe via WebSocket:\n");
    console.log("  const ws = new WebSocket('ws://localhost:3000');");
    console.log("  ws.on('message', (env) => console.log(env));\n");
    console.log("Final stats:");
    console.log(JSON.stringify(getBusStats(), null, 2));
}
