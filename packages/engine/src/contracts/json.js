import { z } from "zod";
export const JsonValueSchema = z.lazy(() => z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
]));
//# sourceMappingURL=json.js.map