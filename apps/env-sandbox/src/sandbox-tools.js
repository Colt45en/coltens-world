/**
 * Sandbox Tools — compact environment mutation kit
 * - Boots from Recursive Creation Codex default
 * - Immutable snapshots + restore + diff
 * - JSON path get/set
 * - Event bus
 * - Tick-based scheduler
 * - Policy-enforced mutations
 * - Tool registry
 *
 * Works in Node 18+ with "type": "module"
 */
function nowIso() {
    return new Date().toISOString();
}
function deepClone(v) {
    return structuredClone(v);
}
/**
 * Minimal diff on JSON values:
 * - compares leaf values recursively
 * - returns list of changed paths
 */
export function diffJson(a, b, basePath = "$") {
    const out = [];
    const walk = (x, y, p) => {
        if (x === y)
            return;
        const xIsObj = x !== null && typeof x === "object" && !Array.isArray(x);
        const yIsObj = y !== null && typeof y === "object" && !Array.isArray(y);
        const xIsArr = Array.isArray(x);
        const yIsArr = Array.isArray(y);
        if (xIsObj && yIsObj) {
            const xObj = x;
            const yObj = y;
            const keys = new Set([...Object.keys(xObj), ...Object.keys(yObj)]);
            for (const k of keys)
                walk(xObj[k], yObj[k], `${p}.${k}`);
            return;
        }
        if (xIsArr && yIsArr) {
            const xa = x;
            const ya = y;
            const n = Math.max(xa.length, ya.length);
            for (let i = 0; i < n; i++)
                walk(xa[i], ya[i], `${p}[${i}]`);
            return;
        }
        // different primitive types / object vs primitive / etc.
        out.push(p);
    };
    walk(a, b, basePath);
    return out;
}
export function parseJsonPath(path) {
    const s = path.trim();
    if (!s.startsWith("$"))
        throw new Error(`Path must start with "$": ${path}`);
    const tokens = [];
    let i = 1;
    const isIdentChar = (c) => /[A-Za-z0-9_$-]/.test(c);
    while (i < s.length) {
        const c = s[i];
        if (c === ".") {
            i++;
            let key = "";
            while (i < s.length && isIdentChar(s[i])) {
                key += s[i++];
            }
            if (!key)
                throw new Error(`Expected property after "." in path: ${path}`);
            tokens.push({ kind: "prop", key });
            continue;
        }
        if (c === "[") {
            i++;
            // string key?
            if (i < s.length && (s[i] === `"` || s[i] === `'`)) {
                const quoteChar = s[i];
                const quote = quoteChar;
                i++;
                let key = "";
                while (i < s.length && s[i] !== quote) {
                    key += s[i++];
                }
                if (i >= s.length || s[i] !== quote)
                    throw new Error(`Unterminated string bracket in path: ${path}`);
                i++; // close quote
                if (i >= s.length || s[i] !== "]")
                    throw new Error(`Expected ] in path: ${path}`);
                i++; // close ]
                tokens.push({ kind: "prop", key });
                continue;
            }
            // numeric index
            let num = "";
            while (i < s.length && /[0-9]/.test(s[i]))
                num += s[i++];
            if (!num)
                throw new Error(`Expected index inside [] in path: ${path}`);
            if (i >= s.length || s[i] !== "]")
                throw new Error(`Expected ] in path: ${path}`);
            i++;
            tokens.push({ kind: "index", index: Number(num) });
            continue;
        }
        throw new Error(`Unexpected token "${c}" at position ${i} in path: ${path}`);
    }
    return tokens;
}
export function getByPath(root, path) {
    const tokens = parseJsonPath(path);
    let cur = root;
    for (const t of tokens) {
        if (cur == null)
            return undefined;
        if (t.kind === "prop")
            cur = cur[t.key];
        else
            cur = cur[t.index];
    }
    return cur;
}
export function setByPath(root, path, value) {
    const tokens = parseJsonPath(path);
    const next = deepClone(root);
    let cur = next;
    for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        if (!t)
            throw new Error(`Unexpected missing token at position ${ti}`);
        const isLast = ti === tokens.length - 1;
        if (t.kind === "prop") {
            if (isLast) {
                cur[t.key] = value;
            }
            else {
                const nxt = tokens[ti + 1];
                const existing = cur[t.key];
                if (existing == null) {
                    cur[t.key] = nxt && nxt.kind === "index" ? [] : {};
                }
                cur = cur[t.key];
            }
        }
        else if (t.kind === "index") {
            // index
            if (!Array.isArray(cur))
                throw new Error(`Path index used on non-array at ${path}`);
            if (isLast) {
                cur[t.index] = value;
            }
            else {
                const existing = cur[t.index];
                const nxt = tokens[ti + 1];
                if (existing == null) {
                    cur[t.index] = nxt && nxt.kind === "index" ? [] : {};
                }
                cur = cur[t.index];
            }
        }
    }
    return next;
}
function clamp01(x) {
    if (!Number.isFinite(x))
        throw new Error(`Expected finite number, got ${x}`);
    if (x < 0)
        return 0;
    if (x > 1)
        return 1;
    return x;
}
function randomId(prefix = "job") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
/**
 * Sandbox — controlled environment mutation engine
 */
export class Sandbox {
    state;
    snapshots = [];
    tools = new Map();
    jobs = [];
    listeners = [];
    constructor(initial) {
        this.state = deepClone(initial);
    }
    static bootstrap(codex) {
        const base = {
            meta: {
                title: "Recursive Creation Codex",
                version: "1.0.0",
                created_timestamp: nowIso(),
                recursive_nature: "Nested agentic synthesis with carry-forward imprints"
            },
            philosophical_framework: {
                principles: ["Self-similarity", "Emergence", "Composability"],
                paradoxes: ["Bootstrap", "Observer Effect"],
                roles: ["Observer", "Creator", "Archivist"]
            },
            metaphysical_cosmology: {
                layers: {
                    prime: "pre-symbolic substrate",
                    subtle: "archetypal field",
                    material: "runtime manifestation",
                    "data-plane": "persistent record"
                },
                forces: ["entropy", "synchrony", "selection"],
                fate_entanglement: {
                    description: "Propagation of constraints/affordances across epochs",
                    levels: "Local → Systemic"
                }
            },
            recursive_swarm_infrastructure: {
                components: ["ingest", "router", "agents", "store", "ui"],
                event_processing_flow: ["ingest → classify", "route → agent pool", "act → emit artifacts", "archive → store → index"]
            },
            epochs: [
                {
                    epoch: "E0: Genesis",
                    genesis_timestamp: nowIso(),
                    inherited_imprints: [
                        {
                            origin_epoch: "∅",
                            agent_source: "seed/init",
                            symbolic_fragment: "α",
                            inherited_message: "Let there be a trace."
                        }
                    ],
                    fate_entanglement_inheritance: {
                        inherited_fate_influence: "Primordial bias toward structure",
                        collapse_triggers_carried_forward: ["resource-scarcity"],
                        unseen_influences_carried_forward: ["latent-synchrony"]
                    },
                    symbolic_field_resonance: ["seed", "echo", "trace"],
                    initial_agent_manifestation: [
                        {
                            agent_name: "NEXUS FORGE PRIMORDIAL",
                            symbolic_identity: "Code Automato",
                            inherited_archetypal_fragments: ["craft", "order"]
                        }
                    ]
                }
            ],
            orchestration: {
                agents: [
                    {
                        name: "NEXUS",
                        role: "AI the overseer",
                        model: "real processing and Thinking"
                    }
                ]
            },
            environment: {
                forces: {
                    entropy: { weight: 0.5 },
                    synchrony: { weight: 0.5 },
                    selection: { weight: 0.5 }
                },
                vars: {},
                scheduler: { tick: 0 },
                policy: {
                    allowVarKeyRegex: "^[A-Z][A-Z0-9_]*$",
                    allowPathRegex: "^\\$\\.(environment|epochs|orchestration|metaphysical_cosmology|philosophical_framework|recursive_swarm_infrastructure|meta)(\\.|\\[).+",
                    requireReason: false,
                    maxSnapshots: 200,
                    maxScheduled: 1000
                }
            }
        };
        const merged = codex ? deepClone({ ...base, ...codex }) : base;
        return new Sandbox(merged);
    }
    on(fn) {
        this.listeners.push(fn);
        return () => {
            const i = this.listeners.indexOf(fn);
            if (i >= 0)
                this.listeners.splice(i, 1);
        };
    }
    emit(e) {
        for (const fn of this.listeners) {
            try {
                fn(e);
            }
            catch (err) {
                // never let a listener crash the sandbox
                console.error("Listener error:", err);
            }
        }
    }
    getState() {
        return deepClone(this.state);
    }
    /** Strict policy check for JSON-path mutation */
    assertPathAllowed(path) {
        const rx = new RegExp(this.state.environment.policy.allowPathRegex);
        if (!rx.test(path))
            throw new Error(`Policy denied path: ${path}`);
    }
    /** Strict policy check for var keys */
    assertVarKeyAllowed(key) {
        const rx = new RegExp(this.state.environment.policy.allowVarKeyRegex);
        if (!rx.test(key))
            throw new Error(`Policy denied var key: ${key}`);
    }
    /** Require reason if configured */
    assertReason(meta) {
        if (!this.state.environment.policy.requireReason)
            return;
        if (!meta?.reason || meta.reason.trim().length < 3) {
            throw new Error(`Policy requires reason (>=3 chars) for mutations.`);
        }
    }
    /** Low-level mutation */
    set(path, value, meta) {
        this.assertPathAllowed(path);
        this.assertReason(meta);
        const before = getByPath(this.state, path);
        const next = setByPath(this.state, path, value);
        this.state = next;
        this.emit({
            type: "MUTATION",
            tick: this.state.environment.scheduler.tick,
            path,
            before,
            after: value,
            ...(meta?.reason ? { reason: meta.reason } : {}),
            ...(meta?.by ? { by: meta.by } : {})
        });
    }
    get(path) {
        return getByPath(this.state, path);
    }
    /** Convenience: runtime vars */
    setVar(key, value, meta) {
        this.assertVarKeyAllowed(key);
        this.assertReason(meta);
        this.set(`$.environment.vars["${key}"]`, value, meta);
    }
    /** Convenience: runtime forces */
    setForceWeight(force, weight, meta) {
        const w = clamp01(weight);
        this.assertReason(meta);
        this.set(`$.environment.forces["${force}"]`, { weight: w }, meta);
    }
    /** Snapshot state immutably */
    snapshot(name, note) {
        if (!name || name.trim().length < 1)
            throw new Error("Snapshot name required.");
        if (this.snapshots.length >= this.state.environment.policy.maxSnapshots) {
            throw new Error(`Snapshot limit reached (${this.state.environment.policy.maxSnapshots}).`);
        }
        const rec = {
            name,
            tick: this.state.environment.scheduler.tick,
            created_at: nowIso(),
            ...(note ? { note } : {}),
            state: deepClone(this.state)
        };
        this.snapshots.push(rec);
        this.emit({
            type: "SNAPSHOT",
            tick: rec.tick,
            name: rec.name,
            ...(rec.note ? { note: rec.note } : {})
        });
    }
    listSnapshots() {
        return this.snapshots.map(({ name, tick, created_at, note }) => ({
            name,
            tick,
            created_at,
            ...(note ? { note } : {})
        }));
    }
    restore(name) {
        const rec = this.snapshots.find((s) => s.name === name);
        if (!rec)
            throw new Error(`Unknown snapshot: ${name}`);
        this.state = deepClone(rec.state);
        this.emit({ type: "RESTORE", tick: this.state.environment.scheduler.tick, name });
    }
    diffSnapshots(aName, bName) {
        const a = this.snapshots.find((s) => s.name === aName);
        const b = this.snapshots.find((s) => s.name === bName);
        if (!a || !b)
            throw new Error(`Unknown snapshots: ${aName}, ${bName}`);
        const changedPaths = diffJson(a.state, b.state, "$");
        return { changedPaths };
    }
    diffCurrent(name) {
        const a = this.snapshots.find((s) => s.name === name);
        if (!a)
            throw new Error(`Unknown snapshot: ${name}`);
        const changedPaths = diffJson(a.state, this.state, "$");
        return { changedPaths };
    }
    /** Tool registry */
    registerTool(name, fn) {
        if (!name || name.trim().length < 1)
            throw new Error("Tool name required.");
        this.tools.set(name, fn);
    }
    listTools() {
        return [...this.tools.keys()].sort();
    }
    runTool(name, input, meta) {
        const fn = this.tools.get(name);
        if (!fn)
            throw new Error(`Unknown tool: ${name}`);
        this.assertReason(meta);
        this.emit({
            type: "TOOL_RUN",
            tick: this.state.environment.scheduler.tick,
            tool: name,
            input: deepClone(input),
            ...(meta?.reason ? { reason: meta.reason } : {}),
            ...(meta?.by ? { by: meta.by } : {})
        });
        const ctx = this.makeToolContext();
        fn(ctx, input);
    }
    /** Scheduler */
    schedule(afterTicks, label, fn) {
        const t = Math.floor(afterTicks);
        if (!Number.isFinite(t) || t < 0)
            throw new Error(`afterTicks must be >= 0, got ${afterTicks}`);
        if (this.jobs.length >= this.state.environment.policy.maxScheduled) {
            throw new Error(`Scheduled job limit reached (${this.state.environment.policy.maxScheduled}).`);
        }
        const id = randomId("sched");
        const dueTick = this.state.environment.scheduler.tick + t;
        this.jobs.push({ id, dueTick, label, fn });
        this.emit({
            type: "SCHEDULED",
            tick: this.state.environment.scheduler.tick,
            id,
            dueTick,
            label
        });
        return id;
    }
    tick(n = 1) {
        const steps = Math.max(1, Math.floor(n));
        for (let i = 0; i < steps; i++) {
            // advance tick
            const cur = this.state.environment.scheduler.tick;
            this.state.environment.scheduler.tick = cur + 1;
            this.emit({ type: "TICK", tick: this.state.environment.scheduler.tick });
            // run due jobs (stable order by dueTick then insertion)
            const due = this.jobs.filter((j) => j.dueTick <= this.state.environment.scheduler.tick);
            this.jobs = this.jobs.filter((j) => j.dueTick > this.state.environment.scheduler.tick);
            for (const job of due) {
                try {
                    job.fn(this.makeToolContext());
                }
                catch (err) {
                    this.emit({
                        type: "ERROR",
                        tick: this.state.environment.scheduler.tick,
                        message: err instanceof Error ? err.message : String(err),
                        context: { id: job.id, label: job.label, dueTick: job.dueTick }
                    });
                }
            }
        }
    }
    /** Internal: controlled context given to tools */
    makeToolContext() {
        return {
            state: this.getState(),
            set: (path, value, meta) => this.set(path, value, meta),
            setVar: (key, value, meta) => this.setVar(key, value, meta),
            setForceWeight: (force, weight, meta) => this.setForceWeight(force, weight, meta),
            schedule: (afterTicks, label, fn) => this.schedule(afterTicks, label, fn)
        };
    }
}
/** Built-in tools */
export const tools = {
    setForceWeight: ((ctx, input) => {
        const obj = input;
        const force = String(obj.force ?? "");
        const weight = Number(obj.weight);
        if (!force)
            throw new Error("setForceWeight: force required");
        ctx.setForceWeight(force, weight);
    }),
    setVar: ((ctx, input) => {
        const obj = input;
        const key = String(obj.key ?? "");
        const value = (obj.value ?? null);
        if (!key)
            throw new Error("setVar: key required");
        ctx.setVar(key, value);
    }),
    addAgent: ((ctx, input) => {
        const obj = input;
        const name = String(obj.name ?? "").trim();
        const role = String(obj.role ?? "").trim();
        const model = String(obj.model ?? "real processing and Thinking").trim();
        if (!name)
            throw new Error("addAgent: name required");
        if (!role)
            throw new Error("addAgent: role required");
        const agents = (ctx.state.orchestration?.agents ?? []);
        const next = [...agents, { name, role, model }];
        ctx.set("$.orchestration.agents", next);
    }),
    advanceEpoch: ((ctx, input) => {
        const obj = input;
        const label = String(obj.label ?? "").trim();
        if (!label)
            throw new Error("advanceEpoch: label required");
        const resonance = (Array.isArray(obj.resonance) ? obj.resonance : []);
        const carryTriggers = (Array.isArray(obj.carryTriggers) ? obj.carryTriggers : []);
        const carryInfluences = (Array.isArray(obj.carryInfluences) ? obj.carryInfluences : []);
        const epochs = ctx.state.epochs ?? [];
        const prev = epochs[epochs.length - 1];
        const inherited_imprints = prev?.inherited_imprints?.length
            ? JSON.parse(JSON.stringify(prev.inherited_imprints))
            : [
                {
                    origin_epoch: prev?.epoch ?? "∅",
                    agent_source: "sandbox/advanceEpoch",
                    symbolic_fragment: "↻",
                    inherited_message: "Carry-forward imprint."
                }
            ];
        const nextEpoch = {
            epoch: label,
            genesis_timestamp: new Date().toISOString(),
            inherited_imprints,
            fate_entanglement_inheritance: {
                inherited_fate_influence: "Inherited constraints/affordances (policy-carried).",
                collapse_triggers_carried_forward: carryTriggers.length ? carryTriggers : prev?.fate_entanglement_inheritance?.collapse_triggers_carried_forward ?? [],
                unseen_influences_carried_forward: carryInfluences.length ? carryInfluences : prev?.fate_entanglement_inheritance?.unseen_influences_carried_forward ?? []
            },
            symbolic_field_resonance: resonance.length ? resonance : ["echo", "trace"],
            initial_agent_manifestation: prev?.initial_agent_manifestation ? JSON.parse(JSON.stringify(prev.initial_agent_manifestation)) : []
        };
        ctx.set("$.epochs", [...epochs, nextEpoch]);
    }),
    delayedSetVar: ((ctx, input) => {
        const obj = input;
        const key = String(obj.key ?? "");
        const value = (obj.value ?? null);
        const afterTicks = Number(obj.afterTicks ?? 0);
        if (!key)
            throw new Error("delayedSetVar: key required");
        if (!Number.isFinite(afterTicks) || afterTicks < 0)
            throw new Error("delayedSetVar: afterTicks must be >= 0");
        ctx.schedule(Math.floor(afterTicks), `delayedSetVar(${key})`, (inner) => {
            inner.setVar(key, value, { reason: "scheduled: delayedSetVar" });
        });
    })
};
