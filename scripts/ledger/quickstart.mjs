#!/usr/bin/env node

/**
 * LEDGER QUICK START
 *
 * Get the entire deterministic ledger system running in 5 minutes.
 *
 * Prerequisites:
 * - Node.js 18+
 * - pnpm
 * - Both Nucleus and AgentHub services already installed
 *
 * Run this: pnpm scripts/ledger/quickstart.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.join(__dirname, '..', '..');

console.log(`\n🚀 Nucleus Ledger Quick Start\n`);

// Check prerequisites
console.log(`✓ Checking prerequisites...`);

const checks = [
  {
    name: 'Node.js version',
    test: () => {
      const v = parseInt(process.version.slice(1));
      return v >= 18;
    },
    required: true,
  },
  {
    name: 'Nucleus ledger module exists',
    test: () => fs.existsSync(path.join(WORKSPACE, 'apps/nucleus/src/ledger/ledger.ts')),
    required: true,
  },
  {
    name: 'AgentHub ledger client exists',
    test: () => fs.existsSync(path.join(WORKSPACE, 'apps/agenthub/src/ledger-client.ts')),
    required: true,
  },
  {
    name: 'Ledger contracts package exists',
    test: () => fs.existsSync(path.join(WORKSPACE, 'packages/ledger-contracts')),
    required: true,
  },
];

let allPassed = true;
for (const check of checks) {
  const passed = check.test();
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${check.name}`);
  if (!passed && check.required) {
    allPassed = false;
  }
}

if (!allPassed) {
  console.error('\n❌ Some required files are missing.');
  console.error('Make sure you have created all ledger modules first.\n');
  process.exit(1);
}

console.log(`\n📦 Next steps to enable the ledger:\n`);

console.log(`1. Wire Nucleus (apps/nucleus/src/index.ts or main.ts):`);
console.log(`
   import { Ledger } from './ledger/ledger';
   import { ApprovalStateMachine } from './approvals/state-machine';

   const ledger = new Ledger({ db_path: 'runtime/nucleus-ledger.db' });
   await ledger.init();

   const approvals = new ApprovalStateMachine();

   // Mount routes:
   app.post('/ledger/append', async (req, res) => { ... });
   app.get('/ledger/stream', async (req, res) => { ... });
   app.get('/approvals/pending', (req, res) => { ... });
   // (See LEDGER_INTEGRATION_GUIDE.ts for full code)
`);

console.log(`\n2. Wire AgentHub (apps/agenthub/src/index.ts or main.ts):`);
console.log(`
   import { LedgerClient } from './ledger-client';

   const ledgerClient = new LedgerClient({
     ledger_url: 'http://localhost:3000',
     agent_id: 'agenthub-1',
   });

   ledgerClient.onToolRequest(async (toolRequest) => {
     // Full approval flow + execution here
   });

   ledgerClient.startPolling(2000);
`);

console.log(`\n3. Start services:`);
console.log(`
   Terminal 1: pnpm --filter ./apps/nucleus run dev
   Terminal 2: pnpm --filter ./apps/agenthub run dev
`);

console.log(`\n4. Verify ledger is running:`);
console.log(`
   curl http://localhost:3000/ledger/status

   Expected response:
   { "max_seq": 0, "mode": "production" }
`);

console.log(`\n5. Run tests:`);
console.log(`
   pnpm run test:replay
`);

console.log(`\n📚 Full documentation: LEDGER_README.md`);
console.log(`📋 Integration guide: LEDGER_INTEGRATION_GUIDE.ts\n`);

console.log(`✨ Ledger system is ready to wire!\n`);
