/**
 * main.js – bootstraps all engine modules and wires the tabbed UI.
 *
 * Modules wired:
 *   World Engine     → real-time ECS tick loop
 *   Brain Nucleus    → agent decision system
 *   Agent Tools      → tool-call registry
 *   Code Editor      → live JS editor with world API access
 *   Graphics Pipeline→ Canvas renderer driven by world ticks
 *   Avatar Creator   → visual avatar builder
 *   Prefab Creator   → blueprint/template editor
 *   Game Environment → live play canvas + HUD
 */

import { MessageBus }          from '../packages/bus/src/MessageBus.js';
import { WorldEngine }         from '../packages/world-engine/src/WorldEngine.js';
import { BrainNucleus }        from '../packages/brain-nucleus/src/BrainNucleus.js';
import { AgentToolRegistry, registerWorldTools } from '../packages/agent-tools/src/AgentTools.js';
import { CodeEditor }          from '../packages/code-editor/src/CodeEditor.js';
import { GraphicsPipeline, ShapeNode, TextNode } from '../packages/graphics-pipeline/src/GraphicsPipeline.js';
import { Avatar, AvatarCreator } from '../packages/avatar-creator/src/AvatarCreator.js';
import { PrefabRegistry, PrefabDef, PrefabCreator } from '../packages/prefab-creator/src/PrefabCreator.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────

const bus      = new MessageBus();
const world    = new WorldEngine(bus, { tickRateHz: 10 });
const nucleus  = new BrainNucleus(bus);
const tools    = new AgentToolRegistry();
const prefabs  = new PrefabRegistry();

registerWorldTools(tools, world);

// Seed a few default prefabs
[
  new PrefabDef('npc',    { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, health: 100, tag: 'npc' }),
  new PrefabDef('player', { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, health: 200, tag: 'player' }, 'npc'),
  new PrefabDef('crate',  { position: { x: 0, y: 0 }, solid: true, loot: [] }),
].forEach(p => prefabs.register(p));

// ── Physics system ──────────────────────────────────────────────────────────

world.registerSystem('physics', (entities, dt) => {
  for (const e of entities) {
    const pos = e.components.get('position');
    const vel = e.components.get('velocity');
    if (!pos || !vel) continue;
    pos.x = (pos.x + vel.x * dt + 400) % 400;
    pos.y = (pos.y + vel.y * dt + 300) % 300;
    e.components.set('position', pos);
  }
});

// ── Spawn demo agents ───────────────────────────────────────────────────────

const COLORS = ['#89b4fa','#a6e3a1','#fab387','#f38ba8','#cba6f7'];
const NAMES  = ['alpha','beta','gamma','delta','epsilon'];

NAMES.forEach((name, i) => {
  world.spawn(name, {
    position: { x: 40 + i * 70, y: 60 + (i % 2) * 80 },
    velocity: { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 },
    color: COLORS[i], label: name,
  });

  const brain = nucleus.createBrain(name);
  brain.remember('color', COLORS[i]);
  brain.remember('tick', 0);

  brain.addPlanner((perc, mem) => {
    const t = mem.get('tick') + 1;
    mem.set('tick', t);
    return (t % 40 === 0) ? 'wander' : null;
  });

  brain.registerAction('wander', (busRef, agentId) => {
    const e = world.getEntity(agentId);
    if (!e) return;
    const vel = e.components.get('velocity') ?? { x: 0, y: 0 };
    vel.x = (Math.random() - 0.5) * 60;
    vel.y = (Math.random() - 0.5) * 60;
    e.components.set('velocity', vel);
  });
});

// ── Graphics Pipeline ───────────────────────────────────────────────────────

let pipeline = null;
let gameRunning = false;

function setupPipeline(canvas) {
  pipeline = new GraphicsPipeline(canvas, null);   // we'll call render manually
  const bg   = pipeline.addLayer('background', 0);
  const main = pipeline.addLayer('entities',   1);
  const ui   = pipeline.addLayer('ui',         2);

  // Static background grid
  for (let gx = 0; gx < 400; gx += 40) {
    for (let gy = 0; gy < 300; gy += 40) {
      bg.add(new ShapeNode({ id:`g${gx}_${gy}`, x:gx, y:gy, shape:'rect', width:40, height:40,
        fillStyle: (gx/40 + gy/40) % 2 === 0 ? '#13131f' : '#0d0d18', strokeStyle:'#1e1e2e', lineWidth:0.5 }));
    }
  }

  // World label
  ui.add(new TextNode({ id:'title', x:4, y:12, text:'🌍 Coltens World', font:'bold 11px sans-serif', fillStyle:'#cdd6f4', align:'left' }));
  ui.add(new TextNode({ id:'tick-hud', x:4, y:26, text:'tick: 0', font:'10px monospace', fillStyle:'#6c7086', align:'left' }));

  bus.on('world:tick', ({ tick }) => {
    const tickHud = ui.get('tick-hud');
    if (tickHud) tickHud.text = `tick: ${tick}`;

    // Sync entity nodes with world state
    const snap = world.snapshot();
    for (const [id, comps] of Object.entries(snap.entities)) {
      const pos   = comps.position;
      const color = comps.color ?? '#ffffff';
      const label = comps.label ?? id;
      if (!pos) continue;

      let node = main.get(`agent-${id}`);
      if (!node) {
        node = new ShapeNode({ id:`agent-${id}`, shape:'circle', radius:12, fillStyle:color,
          strokeStyle:'#ffffff', lineWidth:1 });
        main.add(node);
        const txt = new TextNode({ id:`txt-${id}`, font:'9px sans-serif', fillStyle:'#ffffff', align:'center' });
        main.add(txt);
      }
      node.x = pos.x;
      node.y = pos.y;
      const txt = main.get(`txt-${id}`);
      if (txt) { txt.x = pos.x; txt.y = pos.y + 22; txt.text = label; }
    }
    pipeline.render();
  });
}

// ── Tab wiring ───────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  function activateTab(id) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${id}`));
  }

  tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
  activateTab('game');

  // ── Game Environment tab ───────────────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const startBtn = document.getElementById('btn-start');
  const stopBtn  = document.getElementById('btn-stop');
  const snapBtn  = document.getElementById('btn-snapshot');
  const snapOut  = document.getElementById('snapshot-out');
  const logEl    = document.getElementById('bus-log');

  setupPipeline(canvas);

  startBtn.addEventListener('click', () => {
    world.start();
    gameRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled  = false;
  });
  stopBtn.addEventListener('click', () => {
    world.stop();
    gameRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled  = true;
  });
  snapBtn.addEventListener('click', () => {
    snapOut.textContent = JSON.stringify(world.snapshot(), null, 2);
  });

  bus.on('world:tick', ({ tick }) => {
    if (tick % 5 === 0) {
      const line = document.createElement('div');
      line.textContent = `tick ${tick} — entities: ${world.entities.length}`;
      logEl.appendChild(line);
      if (logEl.children.length > 40) logEl.removeChild(logEl.firstChild);
      logEl.scrollTop = logEl.scrollHeight;
    }
  });

  // ── Code Editor tab ────────────────────────────────────────────────────────
  const editorContainer = document.getElementById('code-editor-root');
  const editor = new CodeEditor(editorContainer, {
    value: `// World API is available via \`world\`, \`bus\`, \`tools\`, \`prefabs\`\n\n// Snapshot current state\nconst snap = world.snapshot();\nconsole.log('entities:', Object.keys(snap.entities).join(', '));\n`,
  });
  editor.mount();
  editor.onRun = (code) => {
    // expose the engine globals so user scripts can interact with the world
    try {
      // eslint-disable-next-line no-new-func
      new Function('world','bus','tools','prefabs', code)(world, bus, tools, prefabs);
    } catch(e) {
      console.error(e);
    }
  };

  // ── Agent Tools tab ────────────────────────────────────────────────────────
  const toolsManifestEl = document.getElementById('tools-manifest');
  const toolCallNameEl  = document.getElementById('tool-call-name');
  const toolCallArgsEl  = document.getElementById('tool-call-args');
  const toolCallBtn     = document.getElementById('tool-call-btn');
  const toolCallOutEl   = document.getElementById('tool-call-out');

  toolsManifestEl.textContent = JSON.stringify(tools.manifest(), null, 2);

  toolCallBtn.addEventListener('click', async () => {
    const name = toolCallNameEl.value.trim();
    let   args = {};
    try { args = JSON.parse(toolCallArgsEl.value || '{}'); } catch { /* keep empty */ }
    try {
      const result = await tools.call(name, args);
      toolCallOutEl.textContent = JSON.stringify(result, null, 2);
    } catch (e) {
      toolCallOutEl.textContent = `Error: ${e.message}`;
    }
  });

  // ── Avatar Creator tab ─────────────────────────────────────────────────────
  const avatarRoot = document.getElementById('avatar-creator-root');
  const avatarCreator = new AvatarCreator(avatarRoot);
  avatarCreator.onSave = (avatar) => {
    console.log('Avatar saved:', avatar.toJSON());
  };
  avatarCreator.mount();

  // ── Prefab Creator tab ─────────────────────────────────────────────────────
  const prefabRoot = document.getElementById('prefab-creator-root');
  const prefabCreator = new PrefabCreator(prefabRoot, prefabs);
  prefabCreator.onSave = (def) => {
    console.log('Prefab saved:', def.toJSON());
  };
  prefabCreator.mount();
});
