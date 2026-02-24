/**
 * World Engine: Web App (Vite compiled)
 *
 * Compiled from HTML + TypeScript via Vite.
 * Result: deterministic, optimized JS bundle.
 */

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");

el.innerHTML = `
  <div style="font-family: system-ui; padding: 2rem;">
    <h1>🌍 World Engine Web Runtime</h1>
    <p><strong>Status:</strong> ✅ Vite HTML+TS compiler online</p>
    <p><strong>Runtime:</strong> ES2022, DOM available</p>
    <pre id="log" style="background: #f5f5f5; padding: 1rem; border-radius: 4px;"></pre>
  </div>
`;

const log = document.getElementById("log")!;
let output = "";

function print(msg: string) {
    output += msg + "\n";
    log.textContent = output;
}

// Test: basic TypeScript
function add(a: number, b: number): number {
    return a + b;
}

print(`✓ TypeScript: add(2, 3) = ${add(2, 3)}`);
print(`✓ DOM: element count = ${document.querySelectorAll("*").length}`);
print(`✓ Build time: ${new Date().toISOString()}`);
