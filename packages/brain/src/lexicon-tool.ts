/**
 * Brain Lexicon Tool
 *
 * Wraps lexicon queries with governance policy enforcement.
 * Implements confidence-based decision making with escalation rules.
 *
 * Policy:
 * - confidence ≥ 0.80 + not in review → USE (automatic)
 * - 0.65 ≤ confidence < 0.80 → SUGGEST (non-binding, audit trail)
 * - confidence < 0.65 → ESCALATE (request human review before use)
 * - in review queue → DEFER (wait for review completion)
 */


// ============================================================================
// Types & Enums
// ============================================================================

export enum ConfidenceLevel {
    HIGH = "high",        // ≥ 0.80, not in review
    MEDIUM = "medium",    // 0.65–0.80
    LOW = "low",          // < 0.65
    BLOCKED = "blocked",  // in review or failed gates
}

export enum ActionType {
    USE = "use",           // Apply automatically (high confidence)
    SUGGEST = "suggest",   // Propose for audit (medium confidence)
    ESCALATE = "escalate", // Request review (low confidence)
    DEFER = "defer",       // Blocked pending review
    DENY = "deny",         // Failed governance
}

export interface GovernanceDecision {
    action: ActionType;
    confidence: number;
    reason: string;
    symbols: string[];
    review_queue_size?: number;
    recommendation?: string;
}

export interface BrainSymbolContext {
    term: string;
    language: string;
    impact_level: "read" | "write" | "system" | "critical";
}

// ============================================================================
// Brain Lexicon Tool Implementation
// ============================================================================

export class BrainLexiconTool {
    constructor(private lexiconClient: any) { }

    /**
     * Classify confidence level
     */
    private classifyConfidence(
        confidence: number,
        inReview: boolean,
    ): ConfidenceLevel {
        if (inReview) return ConfidenceLevel.BLOCKED;
        if (confidence >= 0.80) return ConfidenceLevel.HIGH;
        if (confidence >= 0.65) return ConfidenceLevel.MEDIUM;
        return ConfidenceLevel.LOW;
    }

    /**
     * Compute action based on confidence + impact level
     */
    private computeAction(
        level: ConfidenceLevel,
        impact: BrainSymbolContext["impact_level"],
    ): ActionType {
        if (level === ConfidenceLevel.BLOCKED) {
            return ActionType.DEFER;
        }

        if (level === ConfidenceLevel.HIGH) {
            return ActionType.USE;
        }

        if (level === ConfidenceLevel.MEDIUM) {
            // For writes/critical, escalate medium confidence
            if (impact === "write" || impact === "critical") {
                return ActionType.ESCALATE;
            }
            return ActionType.SUGGEST;
        }

        if (level === ConfidenceLevel.LOW) {
            if (impact === "critical") {
                return ActionType.DENY;
            }
            return ActionType.ESCALATE;
        }

        return ActionType.DENY;
    }

    /**
     * Resolve symbols from brain execution context
     * Returns governance decision for each symbol
     */
    async resolveSymbols(
        symbols: BrainSymbolContext[],
    ): Promise<Map<string, GovernanceDecision>> {
        const decisions = new Map<string, GovernanceDecision>();
        const reviewQueue = await this.lexiconClient.getReviewQueue();
        const reviewItemIds = new Set(
            reviewQueue.map((item: any) => item.item_id),
        );

        for (const context of symbols) {
            try {
                const lookup = await this.lexiconClient.lookupSymbol(
                    context.term,
                    context.language,
                );

                if (lookup.entries.length === 0) {
                    // Symbol not found in lexicon
                    decisions.set(context.term, {
                        action: ActionType.ESCALATE,
                        confidence: 0,
                        reason: "Symbol not found in lexicon baseline",
                        symbols: [context.term],
                        recommendation:
                            "Symbol is novel or not yet indexed. Request manual review before use.",
                    });
                    continue;
                }

                const bestEntry = lookup.entries[0]; // Highest confidence
                const inReview = reviewItemIds.has(bestEntry.entry_id);
                const confLevel = this.classifyConfidence(
                    bestEntry.overall_confidence,
                    inReview,
                );
                const action = this.computeAction(confLevel, context.impact_level);

                let reason = "";
                let recommendation = "";

                switch (action) {
                    case ActionType.USE:
                        reason = `High confidence (${(bestEntry.overall_confidence * 100).toFixed(1)}%) + not in review`;
                        recommendation = "Apply automatically, log decision for audit.";
                        break;

                    case ActionType.SUGGEST:
                        reason = `Medium confidence (${(bestEntry.overall_confidence * 100).toFixed(1)}%), safe for read operations`;
                        recommendation =
                            "Suggest to user; non-binding. Escalate if write/system impact.";
                        break;

                    case ActionType.ESCALATE:
                        reason = `Low confidence (${(bestEntry.overall_confidence * 100).toFixed(1)}%) or impact=critical`;
                        recommendation =
                            "Request human review + approval before use. Add to escalation queue.";
                        break;

                    case ActionType.DEFER:
                        reason = `Symbol in review queue (${inReview ? "WAITING" : "UNKNOWN"})`;
                        recommendation =
                            "Block use until review completes. Re-query after review approval.";
                        break;

                    case ActionType.DENY:
                        reason = `Failed governance: confidence < 0.65 + impact=critical`;
                        recommendation =
                            "Block use entirely. Escalate to human team for triage.";
                        break;
                }

                decisions.set(context.term, {
                    action,
                    confidence: bestEntry.overall_confidence,
                    reason,
                    symbols: [context.term, ...lookup.runes.map((r) => r.symbol)],
                    review_queue_size: reviewQueue.length,
                    recommendation,
                });
            } catch (err) {
                console.error(`Failed to resolve symbol "${context.term}":`, err);
                decisions.set(context.term, {
                    action: ActionType.DENY,
                    confidence: 0,
                    reason: `Error during lookup: ${(err as Error).message}`,
                    symbols: [context.term],
                    recommendation: "Lookup failed. Block use and escalate to support.",
                });
            }
        }

        return decisions;
    }

    /**
     * Apply governance policy to a batch of symbol resolutions
     * Returns overall action + per-symbol decisions
     */
    async enforcePolicy(
        symbols: BrainSymbolContext[],
    ): Promise<{
        overall_action: ActionType;
        decisions: Map<string, GovernanceDecision>;
        audit_entry: {
            timestamp: string;
            symbols_count: number;
            actions: Record<string, number>;
            escalations: string[];
        };
    }> {
        const decisions = await this.resolveSymbols(symbols);

        // Aggregate action: if any DENY → overall DENY; if any ESCALATE → ESCALATE; etc.
        let overallAction = ActionType.USE;
        const actionCounts: Record<ActionType, number> = {
            [ActionType.USE]: 0,
            [ActionType.SUGGEST]: 0,
            [ActionType.ESCALATE]: 0,
            [ActionType.DEFER]: 0,
            [ActionType.DENY]: 0,
        };
        const escalations: string[] = [];

        decisions.forEach((decision) => {
            actionCounts[decision.action]++;

            if (decision.action === ActionType.DENY) {
                overallAction = ActionType.DENY;
            } else if (decision.action === ActionType.ESCALATE && overallAction !== ActionType.DENY) {
                overallAction = ActionType.ESCALATE;
            } else if (decision.action === ActionType.DEFER && overallAction === ActionType.USE) {
                overallAction = ActionType.DEFER;
            }

            if (
                decision.action === ActionType.ESCALATE ||
                decision.action === ActionType.DENY
            ) {
                escalations.push(decision.symbols[0]);
            }
        });

        return {
            overall_action: overallAction,
            decisions,
            audit_entry: {
                timestamp: new Date().toISOString(),
                symbols_count: symbols.length,
                actions: actionCounts,
                escalations,
            },
        };
    }
}

// ============================================================================
// Integration Helper: Create Brain Tool
// ============================================================================

export function createBrainLexiconTool(lexiconClient: any): BrainLexiconTool {
    return new BrainLexiconTool(lexiconClient);
}
