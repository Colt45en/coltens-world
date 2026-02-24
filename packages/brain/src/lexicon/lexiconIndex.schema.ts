import { z } from "zod";

export const SemVerSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
export const IsoDateTimeSchema = z.string().datetime();
export const NonEmptyStringSchema = z.string().min(1);
export const StableIdSchema = z
    .string()
    .min(3)
    .max(256)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const LexiconIndexEntrySchema = z
    .object({
        process_tag: StableIdSchema,
        term: NonEmptyStringSchema,
        canonical_term: NonEmptyStringSchema,
        type: NonEmptyStringSchema,
        operator_class: StableIdSchema,
        file: NonEmptyStringSchema
    })
    .strict();

export const LexiconIndexSchema = z
    .object({
        schema: z
            .object({
                name: z.literal("ai_prompt_lexicon.index"),
                version: SemVerSchema
            })
            .strict(),
        generatedAt: IsoDateTimeSchema,
        rootDir: NonEmptyStringSchema,
        entries: z.array(LexiconIndexEntrySchema).min(1)
    })
    .strict();

export type LexiconIndex = z.infer<typeof LexiconIndexSchema>;
