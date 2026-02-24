/**
 * Brace Balance - Structural analysis
 */

export type BraceBalance = {
  remaining: number;
  mismatch: number;
};

export function braceBalance(code: string): BraceBalance {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const openers = new Set(Object.keys(pairs));
  const closers = new Set(Object.values(pairs));

  const stack: string[] = [];
  let mismatch = 0;

  for (const ch of code) {
    if (openers.has(ch)) {
      stack.push(ch);
    } else if (closers.has(ch)) {
      const top = stack.pop();
      if (!top || pairs[top] !== ch) {
        mismatch++;
      }
    }
  }

  return { remaining: stack.length, mismatch };
}
