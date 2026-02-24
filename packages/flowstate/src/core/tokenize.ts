/**
 * Tokenize - Pure lexical analysis
 */

export function tokenize(code: string): string[] {
  return (
    code.match(
      /[A-Za-z_][A-Za-z0-9_]*|\d+|==|!=|<=|>=|=>|[{}()[\];,.:+\-*/%<>]|"[^"]*"|'[^']*'|`[^`]*`/g
    ) || []
  );
}
