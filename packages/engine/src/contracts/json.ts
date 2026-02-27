import { z } from "zod";

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
);

export type JsonValue = z.infer<typeof JsonValueSchema>;
