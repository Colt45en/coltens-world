// optimize-operator-demo.ts
import { OPTIMIZE_OPERATOR_VALIDATED, renderTemplate } from "./optimize-operator";

// Demo: Render a code performance optimization prompt
const codePrompt = renderTemplate(
  OPTIMIZE_OPERATOR_VALIDATED.prompt_templates.code_performance.template,
  {
    language: "TypeScript",
    metric: "latency"
  }
);

console.log("=== Code Performance Optimization Prompt ===");
console.log(codePrompt);
console.log();

// Demo: Show all available optimization dimensions
console.log("=== Available Optimization Dimensions ===");
OPTIMIZE_OPERATOR_VALIDATED.optimization_dimensions.forEach(dim => {
  console.log(`- ${dim}`);
});
console.log();

// Demo: Show required prompt fields
console.log("=== Required Prompt Fields ===");
OPTIMIZE_OPERATOR_VALIDATED.required_prompt_fields.forEach(field => {
  console.log(`- ${field}`);
});
console.log();

// Demo: Show synonyms by intent
console.log("=== Synonyms by Intent ===");
Object.entries(OPTIMIZE_OPERATOR_VALIDATED.synonyms_by_intent).forEach(([intent, synonyms]) => {
  console.log(`${intent}: ${synonyms.join(", ")}`);
});
