/**
 * NSG v1.0 Parser
 *
 * Deterministic recursive-descent parser for Nexus Symbol Grammar.
 * Produces canonical AST with fixed operator precedence and associativity.
 */

import type { ASTNode, Features, Payload, Span, Term } from "./nsg-ast";
import type { Token } from "./nsg-tokenizer";
import { tokenize } from "./nsg-tokenizer";

/**
 * Parser state machine
 */
class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode[] {
    const statements: ASTNode[] = [];

    while (!this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }
      // consume optional semicolon
      if (this.match("SEMI")) {
        // consume
      }
    }

    return statements;
  }

  private parseStatement(): ASTNode | null {
    let expr = this.parseExpression();
    if (!expr) return null;

    // check for postfix ! (seal)
    if (this.match("SEAL")) {
      expr = {
        kind: "Seal",
        body: expr,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    // check for postfix ? (query) — typically at statement level
    if (this.match("QUERY")) {
      expr = {
        kind: "Query",
        body: expr,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return expr;
  }

  private parseExpression(): ASTNode | null {
    return this.parseAlt();
  }

  /**
   * parseAlt: handles | (lowest precedence)
   * alt := link ( "|" link )*
   */
  private parseAlt(): ASTNode | null {
    let left = this.parseLink();
    if (!left) return null;

    if (this.check("PIPE")) {
      const children: ASTNode[] = [left];
      while (this.match("PIPE")) {
        const right = this.parseLink();
        if (!right) this.error("expected expression after |");
        children.push(right);
      }
      return {
        kind: "Alt",
        children,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return left;
  }

  /**
   * parseLink: handles <->
   * link := flow ( "<->" flow )*
   */
  private parseLink(): ASTNode | null {
    let left = this.parseFlow();
    if (!left) return null;

    if (this.check("LINK")) {
      const children: ASTNode[] = [left];
      while (this.match("LINK")) {
        const right = this.parseFlow();
        if (!right) this.error("expected expression after <->");
        children.push(right);
      }
      return {
        kind: "Link",
        children,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return left;
  }

  /**
   * parseFlow: handles ->
   * flow := fuse ( "->" fuse )*
   */
  private parseFlow(): ASTNode | null {
    let left = this.parseFuse();
    if (!left) return null;

    if (this.check("ARROW")) {
      const children: ASTNode[] = [left];
      while (this.match("ARROW")) {
        const right = this.parseFuse();
        if (!right) this.error("expected expression after ->");
        children.push(right);
      }
      return {
        kind: "Flow",
        children,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return left;
  }

  /**
   * parseFuse: handles +
   * fuse := amp ( "+" amp )*
   * Associativity: left (A + B + C = (A + B) + C)
   */
  private parseFuse(): ASTNode | null {
    let left = this.parseAmp();
    if (!left) return null;

    if (this.check("PLUS")) {
      const children: ASTNode[] = [left];
      while (this.match("PLUS")) {
        const right = this.parseAmp();
        if (!right) this.error("expected expression after +");
        children.push(right);
      }
      return {
        kind: "Fuse",
        children,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return left;
  }

  /**
   * parseAmp: handles *
   * amp := factor ( "*" factor )*
   */
  private parseAmp(): ASTNode | null {
    let left = this.parseFactor();
    if (!left) return null;

    while (this.match("AMP")) {
      const right = this.parseFactor();
      if (!right) this.error("expected expression after *");
      left = {
        kind: "Amp",
        children: [left, right],
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return left;
  }

  /**
   * parseFactor: handles /
   * factor := primary | primary "/" primary
   */
  private parseFactor(): ASTNode | null {
    let left = this.parsePrimary();
    if (!left) return null;

    if (this.match("SLASH")) {
      const right = this.parsePrimary();
      if (!right) this.error("expected expression after /");
      return {
        kind: "Split",
        children: [left, right],
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    return left;
  }

  /**
   * parsePrimary: handles terminals, groups, ring applies
   * primary := term | group | ring_apply
   */
  private parsePrimary(): ASTNode | null {
    // ring apply: @ring : expr
    if (this.match("AT")) {
      const ringToken = this.advance();
      if (ringToken.kind !== "ID") this.error("expected ring name after @");
      if (!this.match("COLON")) this.error("expected : after ring name");
      const body = this.parseExpression();
      if (!body) this.error("expected expression after @ring:");
      return {
        kind: "RingApply",
        ring: ringToken.value,
        body,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    // group: (...)
    if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      if (!expr) this.error("expected expression in group");
      if (!this.match("RPAREN")) this.error("expected ) after group");
      return {
        kind: "Group",
        body: expr,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    // query: ? expr
    if (this.match("QUERY")) {
      const body = this.parsePrimary();
      if (!body) this.error("expected expression after ?");
      return {
        kind: "Query",
        body,
        features: {},
        payload: {},
        span: this.lastSpan(),
      };
    }

    // term (atom with optional type, features, payload)
    if (this.check("ID")) {
      return this.parseTerm();
    }

    return null;
  }

  /**
   * parseTerm: handles identifier with optional type/features/payload
   * term := atom type_anno? features? payload? hash_tag?
   */
  private parseTerm(): Term {
    const atom = this.parseAtom();
    let type: unknown;
    const features: Features = {};
    const payload: Payload = {};
    let hash_tag: string | undefined;

    // type annotation: : TYPE
    if (this.match("COLON")) {
      const typeToken = this.advance();
      if (typeToken.kind !== "ID") this.error("expected type name after :");
      // Parser trusts NSG grammar; type validation occurs in rewrite engine
      type = typeToken.value;
    }

    // features: [...]
    if (this.match("LBRACKET")) {
      while (!this.check("RBRACKET") && !this.isAtEnd()) {
        const featureName = this.advance();
        if (featureName.kind !== "ID") this.error("expected feature name");

        if (this.match("EQ")) {
          const valueToken = this.advance();
          const value = this.parseValue(valueToken);
          features[featureName.value] = value;
        } else {
          features[featureName.value] = true;
        }

        if (!this.check("RBRACKET") && !this.match("COMMA")) {
          this.error("expected , or ] in features");
        }
      }
      if (!this.match("RBRACKET")) this.error("expected ] after features");
    }

    // payload: { ... }
    if (this.match("LBRACE")) {
      while (!this.check("RBRACE") && !this.isAtEnd()) {
        const keyToken = this.advance();
        if (keyToken.kind !== "ID") this.error("expected key in payload");
        if (!this.match("COLON")) this.error("expected : after payload key");

        const valueToken = this.advance();
        const value = this.parseValue(valueToken);
        payload[keyToken.value] = value;

        if (!this.check("RBRACE") && !this.match("COMMA")) {
          this.error("expected , or } in payload");
        }
      }
      if (!this.match("RBRACE")) this.error("expected } after payload");
    }

    // hash tag: #HEX
    if (this.match("HASH")) {
      const hashToken = this.advance();
      if (hashToken.kind !== "ID" && hashToken.kind !== "STRING") {
        this.error("expected hash value after #");
      }
      hash_tag = hashToken.value;
    }

    return {
      kind: "Term",
      atom,
      type: type as any,
      features,
      payload,
      ...(hash_tag && { hash_tag }),
      span: this.lastSpan(),
    } as Term;
  }

  /**
   * parseAtom: handle namespaced identifiers (a.b.c)
   */
  private parseAtom(): string {
    if (!this.check("ID")) this.error("expected identifier");
    let atom = this.advance().value;

    while (this.match("DOT")) {
      if (!this.check("ID")) this.error("expected identifier after .");
      atom += "." + this.advance().value;
    }

    return atom;
  }

  /**
   * parseValue: convert token to literal value
   */
  private parseValue(token: Token): any {
    switch (token.kind) {
      case "STRING":
        // Remove quotes
        return token.value.slice(1, -1);
      case "NUMBER":
        return parseFloat(token.value);
      case "ID":
        if (token.value === "true") return true;
        if (token.value === "false") return false;
        if (token.value === "null") return null;
        return token.value;
      default:
        this.error(`cannot parse value from ${token.kind}`);
    }
  }

  // Helper methods

  private match(kind: string): boolean {
    if (this.check(kind)) {
      this.pos++;
      return true;
    }
    return false;
  }

  private check(kind: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().kind === kind;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().kind === "EOF";
  }

  private peek(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error("Unexpected end of tokens");
    return token;
  }

  private previous(): Token {
    const token = this.tokens[this.pos - 1];
    if (!token) throw new Error("No previous token");
    return token;
  }

  private lastSpan(): Span {
    const prev = this.previous();
    return { start: prev.span.start, end: prev.span.end };
  }

  private error(message: string): never {
    const token = this.peek();
    throw new Error(
      `Parse error at position ${token.span.start} (token: ${token.kind} "${token.value}"): ${message}`
    );
  }
}

/**
 * Parse NSG source string into AST
 */
export function parseNSG(source: string): ASTNode[] {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Parse a single NSG expression (convenience)
 */
export function parseSingleExpression(source: string): ASTNode {
  const statements = parseNSG(source);
  if (statements.length === 0) {
    throw new Error("Empty expression");
  }
  if (statements.length > 1) {
    throw new Error("Multiple statements; expected single expression");
  }
  return statements[0];
}
