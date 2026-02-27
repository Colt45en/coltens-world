/**
 * Tokenize - Pure lexical analysis
 */
export function tokenize(code) {
    return (code.match(/[A-Za-z_][A-Za-z0-9_]*|\d+|==|!=|<=|>=|=>|[{}()[\];,.:+\-*/%<>]|"[^"]*"|'[^']*'|`[^`]*`/g) || []);
}
