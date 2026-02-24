import { OperatorRegistry } from "./registry/OperatorRegistry";
import { registerOptimizeOperator } from "./optimize-operator"; // your file path

const registry = new OperatorRegistry();

// Register Optimize
const optimizeReg = registerOptimizeOperator();
registry.register({
  schema: optimizeReg.schema,
  entry: optimizeReg.entry,
});

// Resolve by term
const byTerm = registry.resolve("Optimize");
if (!byTerm) throw new Error("Optimize not found by term");
console.log("By term:", byTerm.id, byTerm.entry.term, byTerm.entry.process_tag);

// Resolve by process_tag
const byTag = registry.resolve("prompt.operator.optimize");
if (!byTag) throw new Error("Optimize not found by tag");
console.log("By tag:", byTag.id, byTag.entry.term, byTag.entry.process_tag);

// Snapshot
const snap = registry.snapshot();
console.log("Snapshot terms:", Object.keys(snap.byTerm));
console.log("Snapshot tags:", Object.keys(snap.byTag));
