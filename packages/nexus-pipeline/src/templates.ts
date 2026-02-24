import type { Analysis, RunContext, TemplateBinding, TemplateDef } from "./types";
import { clamp } from "./utils";

const StructuralTemplates = {
    js_map_filter(data: string, transform: string, predicate: string) {
        return `${data}
  .map(${transform})
  .filter(${predicate});`;
    },
    html_component(tag: string, className: string, content: string) {
        return `<${tag} class="${className}">
  ${content}
</${tag}>`;
    },
};

function motif(analysis: Analysis, id: string) {
    return analysis.motifs.find(m => m.id === id);
}

export const DEFAULT_TEMPLATES: TemplateDef[] = [
    {
        id: "tpl.code.js_map_filter.direct",
        domain: "code",
        label: "JS map/filter (direct chain)",
        requiredMotifs: ["motif.js.map_filter"],
        claim: (analysis) => {
            const m = motif(analysis, "motif.js.map_filter");
            if (!m?.data) return [];
            return [{ motifId: m.id, args: m.data as any, confidence: m.confidence }];
        },
        render: (binding: TemplateBinding) => {
            const a = binding.args as any;
            return StructuralTemplates.js_map_filter(String(a.source), String(a.mapFn), String(a.filterFn));
        },
        baseScore: (binding) => clamp(0.82 + ((binding.confidence ?? 0.85) - 0.85) * 0.2, 0, 1),
        hintFeatures: { readability: 0.75, modularity: 0.35, minimal_diff: 0.85 }
    },
    {
        id: "tpl.code.js_map_filter.module",
        domain: "code",
        label: "JS map/filter (helper module)",
        requiredMotifs: ["motif.js.map_filter"],
        claim: (analysis) => {
            const m = motif(analysis, "motif.js.map_filter");
            if (!m?.data) return [];
            return [{ motifId: m.id, args: m.data as any, confidence: m.confidence }];
        },
        render: (binding: TemplateBinding, ctx: RunContext) => {
            const a = binding.args as any;
            return `// Module synthesis (density=${ctx.density}%)
export function buildPipeline(${a.source}) {
  return ${a.source}
    .map(${a.mapFn})
    .filter(${a.filterFn});
}

// Usage
// const out = buildPipeline(${a.source});`;
        },
        baseScore: (binding, ctx) => {
            const densityBoost = clamp((ctx.density - 55) / 45, 0, 1) * 0.18;
            return clamp(0.70 + densityBoost + ((binding.confidence ?? 0.85) - 0.85) * 0.15, 0, 1);
        },
        hintFeatures: { readability: 0.70, modularity: 0.92, minimal_diff: 0.55 }
    },
    {
        id: "tpl.code.html_component.direct",
        domain: "code",
        label: "HTML component (direct)",
        requiredMotifs: ["motif.html.component"],
        claim: (analysis) => {
            const m = motif(analysis, "motif.html.component");
            if (!m?.data) return [];
            return [{ motifId: m.id, args: m.data as any, confidence: m.confidence }];
        },
        render: (binding: TemplateBinding) => {
            const a = binding.args as any;
            return StructuralTemplates.html_component(String(a.tag), String(a.className), String(a.content));
        },
        baseScore: (binding) => clamp(0.78 + ((binding.confidence ?? 0.8) - 0.8) * 0.25, 0, 1),
        hintFeatures: { readability: 0.72, modularity: 0.35, minimal_diff: 0.83 }
    }
];
