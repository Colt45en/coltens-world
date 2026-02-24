#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const services = [
  {
    name: "NUCLEUS",
    command: "pnpm",
    args: ["-C", "apps/nucleus", "run", "dev"],
    cwd: ROOT,
  },
  {
    name: "IDE",
    command: "pnpm",
    args: ["-C", "apps/ide-web", "run", "dev"],
    cwd: ROOT,
  },
  {
    name: "PREVIEW",
    command: "pnpm",
    args: ["-C", "apps/preview-runtime", "run", "dev"],
    cwd: ROOT,
  },
  {
    name: "AGENT",
    command: "python",
    args: ["apps/agent-suite/agent_main.py"],
    cwd: ROOT,
  },
];

console.log("🚀 Starting World Engine development environment...\n");

const children = [];

for (const service of services) {
  console.log(`Starting ${service.name}...`);
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    stdio: "inherit",
    shell: true,
  });

  children.push({ name: service.name, child });

  child.on("error", (err) => {
    console.error(`❌ ${service.name} failed to start:`, err.message);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`❌ ${service.name} exited with code ${code}`);
    }
  });
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down services...");
  for (const { name, child } of children) {
    console.log(`Stopping ${name}...`);
    child.kill();
  }
  process.exit(0);
});

console.log("\n✅ All services started!");
console.log("🌐 Nucleus: http://localhost:3000");
console.log("🌐 IDE: http://localhost:5173");
console.log("🌐 Preview: http://localhost:5174");
console.log("🤖 Agent: http://localhost:3001");
console.log("\nPress Ctrl+C to stop all services.\n");
