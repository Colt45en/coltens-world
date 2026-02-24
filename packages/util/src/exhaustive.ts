/**
 * Exhaustive discriminated union checking
 * Forces TypeScript to catch missing handlers at compile time
 *
 * @example
 * type Op = { type: "start" } | { type: "stop" };
 *
 * function handleOp(op: Op) {
 *   switch (op.type) {
 *     case "start": return "ok";
 *     case "stop": return "ok";
 *     default: return assertNever(op);
 *   }
 * }
 */
export function assertNever(x: never, message?: string): never {
  // String(x) is safe even for symbols; template literals are not always.
  const detail = safeDescribe(x);
  throw new Error(message ?? `Unreachable code reached. Value: ${detail}`);
}

/** Extract the discriminant value union for key K from union T */
type DiscriminantValue<T, K extends PropertyKey> =
  T extends Record<K, infer V> ? V : never;

/** Build the handler map: one handler for every discriminant value */
type HandlerMap<T, K extends PropertyKey> = {
  [V in DiscriminantValue<T, K> & PropertyKey]: (value: Extract<T, Record<K, V>>) => unknown;
};

/** Disallow extra keys beyond the expected handler map keys */
type Exact<Shape, T extends Shape> = T & Record<Exclude<keyof T, keyof Shape>, never>;

/** Union of all handler return types */
type ReturnsOf<H> = {
  [P in keyof H]: H[P] extends (...args: never[]) => infer R ? R : never;
}[keyof H];

/**
 * Type-safe exhaustive handler for discriminated unions (default key: "type").
 * Missing handler keys => TypeScript error.
 * Extra handler keys => TypeScript error.
 *
 * @example
 * type Op = { type: "start" } | { type: "stop" };
 *
 * const result = exhaustive(op, {
 *   start: () => "started",
 *   stop:  () => "stopped",
 * });
 */
export function exhaustive<
  T extends Record<"type", PropertyKey>,
  H extends HandlerMap<T, "type">
>(
  value: T,
  handlers: Exact<HandlerMap<T, "type">, H>
): ReturnsOf<H> {
  const discr = value.type;
  const handler = (handlers as Record<PropertyKey, (v: T) => unknown>)[discr];

  if (!handler) {
    throw new Error(
      `No handler for discriminant "type"=${safeDescribe(discr)}. Value: ${safeDescribe(value)}`
    );
  }

  return handler(value) as ReturnsOf<H>;
}

/**
 * Same as exhaustive(), but for a custom discriminant key (e.g. "kind", "tag", "op").
 *
 * @example
 * type Node =
 *   | { kind: "num"; value: number }
 *   | { kind: "add"; left: Node; right: Node };
 *
 * const v = exhaustiveBy(node, "kind", {
 *   num: (n) => n.value,
 *   add: (n) => exhaustiveBy(n.left, "kind", ...) + exhaustiveBy(n.right, "kind", ...),
 * });
 */
export function exhaustiveBy<
  T extends Record<K, PropertyKey>,
  K extends PropertyKey,
  H extends HandlerMap<T, K>
>(
  value: T,
  key: K,
  handlers: Exact<HandlerMap<T, K>, H>
): ReturnsOf<H> {
  const discr = value[key];
  const handler = (handlers as Record<PropertyKey, (v: T) => unknown>)[discr];

  if (!handler) {
    throw new Error(
      `No handler for discriminant ${String(key)}=${safeDescribe(discr)}. Value: ${safeDescribe(value)}`
    );
  }

  return handler(value) as ReturnsOf<H>;
}

/** Safe-ish debug formatting (won't crash on circulars, symbols, bigints, etc.) */
function safeDescribe(v: unknown): string {
  const t = typeof v;

  if (t === "string") return JSON.stringify(v);
  if (t === "number" || t === "boolean" || t === "undefined") return String(v);
  if (t === "bigint") return `${String(v)}n`;
  if (t === "symbol") return (v as symbol).toString();
  if (v === null) return "null";

  // object / function
  try {
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return "[Unprintable]";
    }
  }
}
