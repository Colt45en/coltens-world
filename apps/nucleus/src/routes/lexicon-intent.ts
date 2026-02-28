import {
    LexiconLedgerEventV1,
    LexiconRequestV1,
    LexiconToolResultV1
} from "../contracts/lexicon-intent.v1";
import {
    LexiconIntentToolkit,
} from "../tools/lexicon-intent-tools";

/**
 * Lexicon Intent Routes — Nucleus tool registration
 *
 * Registers 4 Lexicon tools:
 * - lexicon.store: Store a snapshot
 * - lexicon.query: Query snapshots for an actor
 * - lexicon.get: Retrieve a snapshot by ID
 * - lexicon.stats: Get storage statistics
 *
 * Type definitions (normally in Nucleus, but included here for reference):
 */

interface ToolHandler {
  (input: unknown): Promise<LexiconToolResultV1>;
}

interface ToolRegistry {
  register(name: string, handler: ToolHandler): void;
}

interface LedgerAppender {
  append(event: LexiconLedgerEventV1): Promise<void>;
}

/**
 * Register all Lexicon tools with Nucleus
 */
export function registerLexiconIntentTools(
  registry: ToolRegistry,
  ledgerAppend: LedgerAppender,
): void {
  const toolkit = new LexiconIntentToolkit();

  // =====================================================================
  // Tool 1: lexicon.store
  // =====================================================================
  registry.register("lexicon.store", async (input: unknown) => {
    try {
      const request = input as LexiconRequestV1;

      if (request.action !== "store") {
        return {
          success: false,
          message: "Expected action='store'",
        };
      }

      const result = toolkit.store(request);

      if (result.ledger_event) {
        await ledgerAppend(result.ledger_event);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  });

  // =====================================================================
  // Tool 2: lexicon.query
  // =====================================================================
  registry.register("lexicon.query", async (input: unknown) => {
    try {
      const request = input as LexiconRequestV1;

      if (request.action !== "query") {
        return {
          success: false,
          message: "Expected action='query'",
        };
      }

      const result = toolkit.query(request);

      if (result.ledger_event) {
        await ledgerAppend(result.ledger_event);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  });

  // =====================================================================
  // Tool 3: lexicon.get
  // =====================================================================
  registry.register("lexicon.get", async (input: unknown) => {
    try {
      const request = input as LexiconRequestV1;

      if (request.action !== "get") {
        return {
          success: false,
          message: "Expected action='get'",
        };
      }

      const result = toolkit.get(request);

      // Note: get doesn't produce a ledger event (read-only operation)

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  });

  // =====================================================================
  // Tool 4: lexicon.stats
  // =====================================================================
  registry.register("lexicon.stats", async (input: unknown) => {
    try {
      const request = input as LexiconRequestV1;

      if (request.action !== "stats") {
        return {
          success: false,
          message: "Expected action='stats'",
        };
      }

      const result = toolkit.stats(request);

      // Note: stats doesn't produce a ledger event (read-only operation)

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        message,
      };
    }
  });
}
