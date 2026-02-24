/**
 * Exhaustive discriminated union checking
 * Forces TypeScript to catch missing handlers at compile time
 *
 * @example
 * type Op = { type: "start" } | { type: "stop" };
 *
 * function handleOp(op: Op) {
 *   switch (op.type) {
 *     case "start": ...
 *     case "stop": ...
 *     // TS error if you forgot a case!
 *     default: assertNever(op);
 *   }
 * }
 */

export function assertNever(x: never): never {
    throw new Error(`Unreachable code reached with value: ${x}`);
}

/**
 * Type-safe exhaustive handler for discriminated unions
 * Returns never, can be used in expressions
 *
 * @example
 * const result = exhaustive(op, {
 *   start: () => "started",
 *   stop: () => "stopped"
 *   // TS error if cases don't match op.type union!
 * });
 */
export function exhaustive<
    T extends { type: string },
    Handlers extends { [K in T["type"]]: (x: Extract<T, { type: K }>) => any }
>(value: T, handlers: Handlers): ReturnType<Handlers[T["type"]]> {
    const handler = handlers[value.type as T["type"]];
    if (!handler) {
        throw new Error(`No handler for discriminant: ${value.type}`);
    }
    return handler(value as never);
}
