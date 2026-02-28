/**
 * NSG v1.0 Tokenizer
 *
 * Deterministic lexical analysis for Nexus Symbol Grammar.
 * Produces ordered token stream suitable for deterministic parsing.
 */

export type TokenKind =
  | "ID"       // identifier: [a-zA-Z_][a-zA-Z0-9_]*
  | "COLON"    // :
  | "DOT"      // .
  | "LPAREN"   // (
  | "RPAREN"   // )
  | "LBRACKET" // [
  | "RBRACKET" // ]
  | "LBRACE"   // {
  | "RBRACE"   // }
  | "ARROW"    // ->
  | "LINK"     // <->
  | "PLUS"     // +
  | "AMP"      // *
  | "SLASH"    // /
  | "PIPE"     // |
  | "AT"       // @
  | "RESON"    // ~
  | "SEAL"     // !
  | "QUERY"    // ?
  | "HASH"     // #
  | "SEMI"     // ;
  | "COMMA"    // ,
  | "EQ"       // =
  | "STRING"   // "..."
  | "NUMBER"   // [0-9]+(\.[0-9]+)?
  | "EOF"
  | "ERROR";

export interface Token {
  kind: TokenKind;
  value: string;
  span: { start: number; end: number };
}

/**
 * NSGTokenizer: deterministic lexical analysis
 *
 * Invariants:
 * - same input → same token stream (deterministic ordering, no whitespace variation)
 * - multi-char operators recognized in fixed precedence (-> before -, <-> before <)
 * - identifiers normalized to NFC (though not enforced here; assumed at parser)
 */
export class NSGTokenizer {
  private input: string;
  private pos: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      // skip whitespace
      const ch = this.input[this.pos];
      if (ch === undefined) break;
      if (this.isWhitespace(ch)) {
        this.pos++;
        continue;
      }

      // multi-char operators (checked first)
      // ch is guaranteed to be defined from above
      if (this.matchString("->")) {
        this.addToken("ARROW", "->");
        this.pos += 2;
        continue;
      }
      if (this.matchString("<->")) {
        this.addToken("LINK", "<->");
        this.pos += 3;
        continue;
      }

      // single-char operators
      // ch already assigned above
      switch (ch) {
        case ":":
          this.addToken("COLON", ":");
          this.pos++;
          break;
        case ".":
          this.addToken("DOT", ".");
          this.pos++;
          break;
        case "(":
          this.addToken("LPAREN", "(");
          this.pos++;
          break;
        case ")":
          this.addToken("RPAREN", ")");
          this.pos++;
          break;
        case "[":
          this.addToken("LBRACKET", "[");
          this.pos++;
          break;
        case "]":
          this.addToken("RBRACKET", "]");
          this.pos++;
          break;
        case "{":
          this.addToken("LBRACE", "{");
          this.pos++;
          break;
        case "}":
          this.addToken("RBRACE", "}");
          this.pos++;
          break;
        case "+":
          this.addToken("PLUS", "+");
          this.pos++;
          break;
        case "*":
          this.addToken("AMP", "*");
          this.pos++;
          break;
        case "/":
          this.addToken("SLASH", "/");
          this.pos++;
          break;
        case "|":
          this.addToken("PIPE", "|");
          this.pos++;
          break;
        case "@":
          this.addToken("AT", "@");
          this.pos++;
          break;
        case "~":
          this.addToken("RESON", "~");
          this.pos++;
          break;
        case "!":
          this.addToken("SEAL", "!");
          this.pos++;
          break;
        case "?":
          this.addToken("QUERY", "?");
          this.pos++;
          break;
        case "#":
          this.addToken("HASH", "#");
          this.pos++;
          break;
        case ";":
          this.addToken("SEMI", ";");
          this.pos++;
          break;
        case ",":
          this.addToken("COMMA", ",");
          this.pos++;
          break;
        case "=":
          this.addToken("EQ", "=");
          this.pos++;
          break;
        case '"':
          this.scanString();
          break;
        case "<":
          // bare < (not <->) is error
          this.addToken("ERROR", ch);
          this.pos++;
          break;
        case "-":
          // bare - (not ->) is error
          this.addToken("ERROR", ch);
          this.pos++;
          break;
        default:
          // ID or NUMBER
          if (ch && this.isDigit(ch)) {
            this.scanNumber();
          } else if (ch && this.isIdentStart(ch)) {
            this.scanIdentifier();
          } else if (ch) {
            this.addToken("ERROR", ch);
            this.pos++;
          } else {
            this.pos++;
          }
      }
    }

    this.addToken("EOF", "");
    return this.tokens;
  }

  private scanString(): void {
    const start = this.pos;
    this.pos++; // consume opening "
    let value = '"';

    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === "\\") {
        value += this.input[this.pos];
        this.pos++;
        if (this.pos < this.input.length) {
          value += this.input[this.pos];
          this.pos++;
        }
      } else {
        value += this.input[this.pos];
        this.pos++;
      }
    }

    if (this.pos < this.input.length) {
      value += this.input[this.pos]; // closing "
      this.pos++;
    }

    this.tokens.push({
      kind: "STRING",
      value,
      span: { start, end: this.pos },
    });
  }

  private scanNumber(): void {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch && this.isDigit(ch)) {
        this.pos++;
      } else {
        break;
      }
    }

    const currCh = this.input[this.pos];
    const nextCh = this.input[this.pos + 1];
    if (
      this.pos < this.input.length &&
      currCh === "." &&
      this.pos + 1 < this.input.length &&
      nextCh && this.isDigit(nextCh)
    ) {
      this.pos++; // consume .
      while (this.pos < this.input.length) {
        const ch = this.input[this.pos];
        if (ch && this.isDigit(ch)) {
          this.pos++;
        } else {
          break;
        }
      }
    }

    const value = this.input.substring(start, this.pos);
    this.tokens.push({
      kind: "NUMBER",
      value,
      span: { start, end: this.pos },
    });
  }

  private scanIdentifier(): void {
    const start = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch && this.isIdentPart(ch)) {
        this.pos++;
      } else {
        break;
      }
    }

    const value = this.input.substring(start, this.pos);
    this.tokens.push({
      kind: "ID",
      value,
      span: { start, end: this.pos },
    });
  }

  private addToken(kind: TokenKind, value: string): void {
    this.tokens.push({
      kind,
      value,
      span: { start: this.pos, end: this.pos + value.length },
    });
  }

  private matchString(s: string): boolean {
    return this.input.substring(this.pos, this.pos + s.length) === s;
  }

  private isWhitespace(ch: string): boolean {
    return /\s/.test(ch);
  }

  private isDigit(ch: string): boolean {
    return /[0-9]/.test(ch);
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isIdentPart(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }
}

/**
 * Convenience function: tokenize a string and return token stream
 */
export function tokenize(input: string): Token[] {
  return new NSGTokenizer(input).tokenize();
}
