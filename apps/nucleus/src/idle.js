/**
 * apps/nucleus/src/idle.ts
 *
 * TypeScript IdleAutonomyGuard — mirrors Python version
 * Reads idle state from JSON, applies commanded state changes
 *
 * Design:
 * - Read IdleGuardState from notes/idle_state.json (synced with Python)
 * - Apply incoming idle.effect.v1 from Python to update local model
 * - Serve GET /idle/state endpoint for IDE to poll
 * - Route idle.command.v1 to Python via notes/events.jsonl
 */
import { IdleEffectV1PayloadSchema, IdleGuardStateSchema, } from "@world-engine/protocol";
import * as fs from "node:fs";
import * as path from "node:path";
export class IdleAutonomyGuard {
    mode;
    notesDir;
    stateFile;
    state;
    approval_ttl_seconds = 3600;
    constructor(mode = "dream_idle", notesDir = "notes") {
        this.mode = mode;
        this.notesDir = notesDir;
        this.stateFile = path.join(notesDir, `idle_state_${mode}.json`);
        // Ensure notes dir exists
        if (!fs.existsSync(notesDir)) {
            fs.mkdirSync(notesDir, { recursive: true });
        }
        // Load state or initialize
        this.state = this._loadState();
    }
    _loadState() {
        if (fs.existsSync(this.stateFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.stateFile, "utf-8"));
                return IdleGuardStateSchema.parse(data);
            }
            catch {
                // Invalid state file, reset
            }
        }
        // Default state
        return {
            mode: this.mode,
            prompted: false,
            prompt_text: "",
            approved: false,
            approval_token: "",
            approval_expires_ts: 0,
            last_activation_ts: 0,
            last_block_reason: "never_checked",
        };
    }
    _saveState() {
        fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), "utf-8");
    }
    /**
     * Can the idle mode activate?
     * Returns [ok, reason]
     */
    canActivate() {
        const now = Date.now() / 1000;
        if (!this.state.prompted) {
            this.state.last_block_reason = "blocked:not_prompted";
            this._saveState();
            return [false, this.state.last_block_reason];
        }
        if (!this.state.approved) {
            this.state.last_block_reason = "blocked:not_approved";
            this._saveState();
            return [false, this.state.last_block_reason];
        }
        if (now > this.state.approval_expires_ts) {
            this.state.last_block_reason = "blocked:approval_expired";
            this.state.approved = false;
            this.state.approval_token = "";
            this._saveState();
            return [false, this.state.last_block_reason];
        }
        return [true, "ok"];
    }
    /**
     * Mark that idle mode started running
     */
    markActivated() {
        const now = Date.now() / 1000;
        this.state.last_activation_ts = now;
        this._saveState();
    }
    /**
     * Approve idle mode (internal, called by applyEffect)
     */
    approve(phrase) {
        const now = Date.now() / 1000;
        this.state.approved = true;
        this.state.approval_token = this._makeToken(phrase);
        this.state.approval_expires_ts = now + this.approval_ttl_seconds;
        this._saveState();
    }
    /**
     * Revoke approval
     */
    revoke(_reason) {
        this.state.approved = false;
        this.state.approval_token = "";
        this.state.approval_expires_ts = 0;
        this._saveState();
    }
    _makeToken(phrase) {
        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        return `${phrase}_${ts}_${rand}`;
    }
    /**
     * Apply idle.effect.v1 from Python guard
     * This updates local state based on effects
     */
    applyEffect(payload) {
        const parsed = IdleEffectV1PayloadSchema.safeParse(payload);
        if (!parsed.success) {
            return;
        }
        const effect = parsed.data;
        if (effect.mode !== this.mode) {
            return;
        }
        // Apply state changes based on effect status
        if (effect.status === "prompted") {
            this.state.prompted = true;
            this.state.prompt_text = effect.prompt_text ?? "";
        }
        else if (effect.status === "approved") {
            this.approve(effect.approval_token ?? "approve");
        }
        else if (effect.status === "revoked") {
            this.revoke(effect.reason);
        }
        else if (effect.status === "blocked") {
            this.state.last_block_reason = effect.reason ?? "unknown";
        }
        else if (effect.status === "activated") {
            this.markActivated();
        }
        this._saveState();
    }
    /**
     * Get current state (for GET /idle/state endpoint)
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get approval TTL for HTTP response
     */
    getApprovalTtl() {
        return this.approval_ttl_seconds;
    }
    /**
     * Set approval TTL
     */
    setApprovalTtl(seconds) {
        this.approval_ttl_seconds = Math.max(60, seconds);
    }
}
/**
 * IdleStateManager — manage multiple idle modes
 */
export class IdleStateManager {
    guards = new Map();
    notesDir;
    constructor(notesDir = "notes") {
        this.notesDir = notesDir;
    }
    /**
     * Get or create guard for mode
     */
    getGuard(mode) {
        if (!this.guards.has(mode)) {
            this.guards.set(mode, new IdleAutonomyGuard(mode, this.notesDir));
        }
        return this.guards.get(mode);
    }
    /**
     * Get state for mode (or throw)
     */
    getState(mode) {
        return this.getGuard(mode).getState();
    }
    /**
     * Apply effect to mode
     */
    applyEffect(mode, payload) {
        this.getGuard(mode).applyEffect(payload);
    }
    /**
     * Check if mode can activate
     */
    canActivate(mode) {
        return this.getGuard(mode).canActivate();
    }
    /**
     * Mark mode activated
     */
    markActivated(mode) {
        this.getGuard(mode).markActivated();
    }
}
