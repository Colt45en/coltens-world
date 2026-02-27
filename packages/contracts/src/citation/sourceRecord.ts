import { z } from "zod";
import { CanonicalIdSchema, ContributorRoleSchema, LcidSchema, SourceTypeSchema } from "./styleSpec";

/** Person contributor (matches Word b:Person parts) */
export const PersonSchema = z
  .object({
    first: z.string().default(""),
    middle: z.string().default(""),
    last: z.string().default(""),
  })
  .strict();

/** Corporate contributor */
export const CorporateSchema = z
  .object({
    corporate: z.string().min(1),
  })
  .strict();

/** Contributor list: either corporate OR people */
export const ContributorListSchema = z
  .object({
    role: ContributorRoleSchema,
    corporate: z.string().default(""),
    persons: z.array(PersonSchema).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasCorp = v.corporate.trim().length > 0;
    const hasPersons = v.persons.some((p) => (p.first + p.middle + p.last).trim().length > 0);
    if (!hasCorp && !hasPersons) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `ContributorList role=${v.role} must have corporate or persons` });
    }
    if (hasCorp && hasPersons) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `ContributorList role=${v.role} cannot have both corporate and persons` });
    }
  });

/** Dates used by Word sources */
export const PartialDateSchema = z
  .object({
    year: z.string().default(""),
    month: z.string().default(""),
    day: z.string().default(""),
  })
  .strict();

export const SourceRecordSchema = z
  .object({
    source_id: CanonicalIdSchema,
    source_type: SourceTypeSchema,
    lcid: LcidSchema.default(1033),

    // Core title fields
    title: z.string().default(""),
    short_title: z.string().default(""),
    title_prefix: z.string().default(""),

    // Publication context (subset; add fields as needed)
    year: z.string().default(""),
    month: z.string().default(""),
    day: z.string().default(""),

    year_accessed: z.string().default(""),
    month_accessed: z.string().default(""),
    day_accessed: z.string().default(""),

    city: z.string().default(""),
    publisher: z.string().default(""),
    institution: z.string().default(""),
    journal_name: z.string().default(""),
    periodical_title: z.string().default(""),
    internet_site_title: z.string().default(""),
    production_company: z.string().default(""),
    distributor: z.string().default(""),
    broadcaster: z.string().default(""),
    station: z.string().default(""),
    theater: z.string().default(""),
    court: z.string().default(""),

    medium: z.string().default(""),
    album_title: z.string().default(""),
    book_title: z.string().default(""),
    publication_title: z.string().default(""),
    broadcast_title: z.string().default(""),

    edition: z.string().default(""),
    volume: z.string().default(""),
    issue: z.string().default(""),
    number_volumes: z.string().default(""),
    pages: z.string().default(""),

    url: z.string().default(""),
    version: z.string().default(""),

    patent_number: z.string().default(""),
    patent_type: z.string().default(""),
    country_region: z.string().default(""),

    case_number: z.string().default(""),
    abbreviated_case_number: z.string().default(""),

    reporter: z.string().default(""),
    thesis_type: z.string().default(""),
    department: z.string().default(""),

    standard_number: z.string().default(""),
    comments: z.string().default(""),

    // Contributors
    contributors: z.array(ContributorListSchema).default([]),

    // Optional tag from Word b:Tag (used as fallback when author/year missing)
    tag: z.string().default(""),
  })
  .strict();

export type SourceRecord = z.infer<typeof SourceRecordSchema>;
