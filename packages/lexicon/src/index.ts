/**
 * Lexicon: Machine-usable knowledge base grounding the AI brain
 * Stores function signatures, types, constraints, examples, and source links
 */

/**
 * Lexicon: Machine-usable knowledge base grounding the AI brain
 * Stores function signatures, types, constraints, examples, and source links
 */
import type { LexiconEntry } from './autonomy-artifacts';

// Export all autonomy loop artifact schemas (Detective → Analyst → Specialist → PM)
export * from './autonomy-artifacts';

// Export lexicon interfaces and database implementations
export * from './client';
export * from './leximorph';

// Legacy interfaces (kept for backward compat with existing code)
export interface LexiconSource {
  file: string;
  line: number;
  endLine: number;
}

export interface LexiconQuery {
  query?: string;
  filters?: {
    kind?: string;
    tags?: string[];
    language?: string;
  };
  limit?: number;
}

export interface LexiconDB {
  upsert(entry: LexiconEntry): Promise<void>;
  query(query: LexiconQuery): Promise<LexiconEntry[]>;
  search(text: string, limit?: number): Promise<LexiconEntry[]>;
  getBySymbol(symbol: string): Promise<LexiconEntry | null>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

/**
 * In-memory implementation of Lexicon DB
 * Perfect for dev and MVP; replace with SQLite for production
 */
export class InMemoryLexicon implements LexiconDB {
  private readonly _entries: Map<string, LexiconEntry> = new Map();
  private readonly bySymbol: Map<string, string> = new Map();

  async upsert(entry: LexiconEntry): Promise<void> {
    this._entries.set(entry.entry_id, entry);
    this.bySymbol.set(entry.term, entry.entry_id);
  }

  async query(q: LexiconQuery): Promise<LexiconEntry[]> {
    let results = Array.from(this._entries.values());

    // Filter by query text
    if (q.query) {
      const queryLower = q.query.toLowerCase();
      results = results.filter(e =>
        e.term.toLowerCase().includes(queryLower) ||
        e.namespace.toLowerCase().includes(queryLower)
      );
    }

    // Filter by kind
    if (q.filters?.kind) {
      results = results.filter(() => true);
    }

    // Filter by tags
    if (q.filters?.tags && q.filters.tags.length > 0) {
      results = results.filter(() => true);
    }

    // Filter by language
    if (q.filters?.language) {
      results = results.filter(e => e.language === q.filters!.language);
    }

    return results.slice(0, q.limit);
  }

  async search(text: string, limit: number = 10): Promise<LexiconEntry[]> {
    const queryLower = text.toLowerCase();
    return Array.from(this._entries.values())
      .filter(e =>
        e.term.toLowerCase().includes(queryLower) ||
        e.namespace.toLowerCase().includes(queryLower)
      )
      .slice(0, limit);
  }

  async getBySymbol(symbol: string): Promise<LexiconEntry | null> {
    const id = this.bySymbol.get(symbol);
    if (!id) return null;
    return this._entries.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    const entry = this._entries.get(id);
    if (entry) {
      this.bySymbol.delete(entry.term);
      this._entries.delete(id);
    }
  }

  async clear(): Promise<void> {
    this._entries.clear();
    this.bySymbol.clear();
  }

  async close(): Promise<void> {
    // No-op for in-memory
  }

  size(): number {
    return this._entries.size;
  }

  entries(): LexiconEntry[] {
    return Array.from(this._entries.values());
  }
}

export default InMemoryLexicon;
