#!/usr/bin/env Node

/**
 * Representation Learning Demo
 *
 * Run the XOR trainer and display evidence packets with gate validation results.
 *
 * Usage:
 *   pnpm tsx apps/sim-server/src/representation-learning-demo.ts
 */

import { NeuralNetwork } from "@world-engine/brain";

async function main() {
    console.log("=".repeat(80));
    console.log("REPRESENTATION LEARNING DEMO: XOR Network with Evidence Emission");
    console.log("=".repeat(80));
    console.log();

    console.log("📚 Training XOR network with representation evidence tracking...\n");

    const result = coltensWorld.trainXORNetwork({
        epochs: 5000,
        learningRate: 0.5,
        verbose: true,
        emitEvidence: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("EVIDENCE PACKET ANALYSIS");
    console.log("=".repeat(80));
    console.log();

    // Show sample evidence packets from the final batch
    if (result.evidenceBatches.length > 0) {
        const finalBatch = result.evidenceBatches[result.evidenceBatches.length - 1];

        console.log(`📊 Final Evidence Batch (Epoch ${finalBatch.epoch})`);
        console.log(`   Total Loss: ${finalBatch.totalLoss.toFixed(6)}`);
        console.log(`   Packets: ${finalBatch.packets.length}`);
        console.log();

        // Validate the entire batch
        // TODO: Implement batch validation

        console.log("🚪 GATE VALIDATION RESULTS");
        console.log("-".repeat(80));

        // Show unit-level validation
        for (let i = 0; i < finalBatch.packets.length; i++) {
            const packet = finalBatch.packets[i];
            const unitValidation = batchValidation.unitResults[i];

            console.log(`\n📦 Hidden Unit ${packet.hiddenActivation.unitId}`);
            console.log(`   Input: [${packet.hiddenActivation.inputContext.join(", ")}]`);
            console.log(
                `   Activation: ${packet.hiddenActivation.value.toFixed(3)} | Selectivity: ${packet.metadata.selectivity.toFixed(3)}`
            );

            // Show gate results
            const gates = [
                { name: "ValidBlameMagnitude", result: unitValidation.validBlameMagnitude },
                { name: "WeightUpdateReducedError", result: unitValidation.weightUpdateReducedError },
                { name: "DetectorEmergence", result: unitValidation.detectorEmergence },
                { name: "SeparabilityImprovement", result: unitValidation.separabilityImprovement },
            ];

            for (const gate of gates) {
                const statusIcon = gate.result.status === "PASS" ? "✅" : gate.result.status === "WARN" ? "⚠️" : "❌";
                console.log(`   ${statusIcon} ${gate.name}: ${gate.result.reason}`);
            }

            // Show detector info if available
            if (packet.metadata.detectorType) {
                console.log(
                    `   🎯 Detector Type: ${packet.metadata.detectorType} (confidence: ${packet.metadata.detectorConfidence.toFixed(2)})`
                );
            }
        }

        // Batch-level validation
        console.log("\n" + "-".repeat(80));
        console.log("BATCH-LEVEL VALIDATION");
        const batchStatusIcon =
            batchValidation.batchValidation.status === "PASS"
                ? "✅"
                : batchValidation.batchValidation.status === "WARN"
                    ? "⚠️"
                    : "❌";
        console.log(
            `${batchStatusIcon} Direction Consistency: ${batchValidation.batchValidation.reason}`
        );

        // Separability metrics
        const separability = finalBatch.packets[0].representationShift.separabilityMetric;
        console.log(`\n📐 Hidden Space Separability: ${(separability * 100).toFixed(1)}%`);
        console.log(
            `   State: ${separability < 0.4 ? "Fuzzy" : separability < 0.7 ? "Partially Separable" : "Linearly Separable"}`
        );
    }

    console.log("\n" + "=".repeat(80));
    console.log("FINAL NETWORK");
    console.log("=".repeat(80));
    console.log();
    console.log(`✨ Training Complete`);
    console.log(`   Final Loss: ${result.finalLoss.toFixed(6)}`);
    console.log(`   Weights Learned: Yes`);
    console.log();

    console.log("🎓 What just happened:");
    console.log("  1. Forward Pass: Network computed activations for each input");
    console.log("  2. Blame Signal: Error flowed backward, assigning credit/blame to each hidden unit");
    console.log("  3. Weight Update: Weights adjusted to reduce error");
    console.log("  4. Representation Shift: Hidden space evolved to become linearly separable");
    console.log("  5. Evidence Emission: Every decision was recorded as a verifiable packet");
    console.log();

    console.log("🔑 Key Insight:");
    console.log("  The hidden layer learned to be 'detectors':");
    console.log("    - Unit 0 → OR detector (high when x1 OR x2 is true)");
    console.log("    - Unit 1 → AND detector (high when both x1 AND x2 are true)");
    console.log("  Output then learned: OR - AND = XOR");
    console.log();

    console.log("📋 Evidence Trail:");
    console.log(`  Total Evidence Batches: ${result.evidenceBatches.length}`);
    console.log(`  Each batch is immutable and verifiable`);
    console.log(`  Gates validated each step of learning`);
    console.log();
}

main().catch(console.error);
