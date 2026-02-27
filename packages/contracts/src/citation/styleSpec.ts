import { z } from "zod";

/** ===== Shared primitives ===== */

export const LcidSchema = z.number().int().min(1).max(99999);

export const YesNoSchema = z.enum(["yes", "no"]);
export type YesNo = z.infer<typeof YesNoSchema>;

export const TextDirSchema = z.enum(["ltr", "rtl"]);
export type TextDir = z.infer<typeof TextDirSchema>;

export const SemverSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

export const CanonicalIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{1,63}$/);

export const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

/** ===== Enums derived from Word bibliography schema source types ===== */

export const SourceTypeSchema = z.enum([
  "Book",
  "BookSection",
  "JournalArticle",
  "ArticleInAPeriodical",
  "ConferenceProceedings",
  "Report",
  "SoundRecording",
  "Performance",
  "Art",
  "DocumentFromInternetSite",
  "InternetSite",
  "Film",
  "Interview",
  "Patent",
  "ElectronicSource",
  "Case",
  "Misc",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ContributorRoleSchema = z.enum([
  "Author",
  "Editor",
  "Translator",
  "Artist",
  "Composer",
  "Conductor",
  "Performer",
  "Writer",
  "Director",
  "ProducerName",
  "Interviewee",
  "Compiler",
  "Inventor",
  "Counsel",
  "BookAuthor",
]);
export type ContributorRole = z.infer<typeof ContributorRoleSchema>;

/** ===== Locale rules (punctuation + strings) ===== */

export const LocalePropertiesSchema = z
  .object({
    direction: TextDirSchema,

    // spacing / punctuation
    space: z.string().min(1),
    non_breaking_space: z.string().min(1),

    dot: z.string().min(1),
    dot_initial: z.string().min(1),

    list_separator: z.string().min(1),  // e.g. ","
    group_separator: z.string().min(1), // e.g. ";"
    enum_separator: z.string().min(1),  // e.g. ":"
    enum: z.string().min(1),            // e.g. ":"
    equal: z.string().min(1),           // e.g. "="

    open_quote: z.string().min(1),
    close_quote: z.string().min(1),

    open_bracket: z.string().min(1),
    close_bracket: z.string().min(1),

    from_to_dash: z.string().min(1), // e.g. "–"

    open_link: z.string().min(1),
    close_link: z.string().min(1),

    authors_separator: z.string().min(1), // separator between author and "and others"

    // parsing/formatting controls
    end_chars: z.string().min(1), // characters that "end" a segment (prevents dot appending)
    hyphens: z.string().min(1),

    normalize_space: YesNoSchema,
    no_comma_before_and: YesNoSchema,
    no_and_before_last_author: YesNoSchema,
  })
  .strict();

export type LocaleProperties = z.infer<typeof LocalePropertiesSchema>;

export const LocaleStringsSchema = z
  .object({
    online_cap: z.string().min(1),
    online_uncap: z.string().min(1),

    filed_cap: z.string().min(1),
    patent_filed_cap: z.string().min(1),

    in_cap: z.string().min(1),
    in_name_cap: z.string().min(1),

    with_uncap: z.string().min(1),

    version_short_cap: z.string().min(1),

    interview_cap: z.string().min(1),
    interview_with_cap: z.string().min(1),
    interview_by_cap: z.string().min(1),

    by_cap: z.string().min(1),

    and_uncap: z.string().min(1),
    and_others_uncap: z.string().min(1),

    motion_picture_cap: z.string().min(1),

    patent_cap: z.string().min(1),

    edition_short_uncap: z.string().min(1),
    edition_uncap: z.string().min(1),

    retrieved_from_cap: z.string().min(1),
    retrieved_cap: z.string().min(1),
    from_cap: z.string().min(1),
    from_uncap: z.string().min(1),

    no_date_short_uncap: z.string().min(1),

    number_short_cap: z.string().min(1),
    number_short_uncap: z.string().min(1),
    patent_number_short_cap: z.string().min(1),

    pages_continuous_short: z.string().min(1),
    page_short: z.string().min(1),

    sine_nomine_short: z.string().min(1),
    sine_loco_short: z.string().min(1),
    sine_loco_sine_nomine_short: z.string().min(1),

    volume_of_short_cap: z.string().min(1),
    volumes_of_short_cap: z.string().min(1),

    volume_short_cap: z.string().min(1),
    volume_short_uncap: z.string().min(1),
    volumes_short_cap: z.string().min(1),
    volumes_short_uncap: z.string().min(1),

    volume_cap: z.string().min(1),

    author_short_uncap: z.string().min(1),
    book_author_short_uncap: z.string().min(1),
    artist_short_uncap: z.string().min(1),

    writer_cap: z.string().min(1),
    writers_cap: z.string().min(1),
    writer_short_uncap: z.string().min(1),

    conducted_by_cap: z.string().min(1),
    conducted_by_uncap: z.string().min(1),

    conductor_cap: z.string().min(1),
    conductors_cap: z.string().min(1),
    conductor_short_cap: z.string().min(1),
    conductor_short_uncap: z.string().min(1),
    conductors_short_cap: z.string().min(1),
    conductors_short_uncap: z.string().min(1),

    counsel_short_uncap_iso: z.string().min(1),
    counsel_short_uncap: z.string().min(1),

    directed_by_cap: z.string().min(1),
    directed_by_uncap: z.string().min(1),

    director_cap: z.string().min(1),
    directors_cap: z.string().min(1),
    director_short_cap: z.string().min(1),
    director_short_uncap: z.string().min(1),
    directors_short_cap: z.string().min(1),
    directors_short_uncap: z.string().min(1),

    edited_by_cap: z.string().min(1),
    edited_by_uncap: z.string().min(1),

    editor_cap: z.string().min(1),
    editors_cap: z.string().min(1),
    editor_short_cap: z.string().min(1),
    editor_short_uncap: z.string().min(1),
    editors_short_cap: z.string().min(1),
    editors_short_uncap: z.string().min(1),

    interviewee_short_uncap: z.string().min(1),

    interviewer_cap: z.string().min(1),
    interviewers_cap: z.string().min(1),

    inventor_short_uncap: z.string().min(1),

    performed_by_cap: z.string().min(1),
    performed_by_uncap: z.string().min(1),

    performer_cap: z.string().min(1),
    performers_cap: z.string().min(1),
    performer_short_cap: z.string().min(1),
    performer_short_uncap: z.string().min(1),
    performers_short_cap: z.string().min(1),
    performers_short_uncap: z.string().min(1),

    produced_by_cap: z.string().min(1),
    produced_by_uncap: z.string().min(1),

    producer_cap: z.string().min(1),
    producers_cap: z.string().min(1),
    production_company_short_cap: z.string().min(1),
    producer_short_cap: z.string().min(1),
    producers_short_cap: z.string().min(1),
    producer_short_uncap: z.string().min(1),

    translated_by_cap: z.string().min(1),
    translated_by_uncap: z.string().min(1),

    translator_cap: z.string().min(1),
    translators_cap: z.string().min(1),
    translator_short_cap: z.string().min(1),
    translator_short_uncap: z.string().min(1),
    translators_short_cap: z.string().min(1),
    translators_short_uncap: z.string().min(1),

    composer_cap: z.string().min(1),
    composers_cap: z.string().min(1),
    composer_short_cap: z.string().min(1),
    composers_short_cap: z.string().min(1),
    composer_short_uncap_iso: z.string().min(1),

    compiled_by_cap: z.string().min(1),
    compiled_by_uncap: z.string().min(1),

    compiler_cap: z.string().min(1),
    compilers_cap: z.string().min(1),
    compiler_short_cap: z.string().min(1),
    compiler_short_uncap: z.string().min(1),
    compilers_short_cap: z.string().min(1),
    compilers_short_uncap: z.string().min(1),
    compiler_short_uncap_iso: z.string().min(1),
  })
  .strict();

export type LocaleStrings = z.infer<typeof LocaleStringsSchema>;

/**
 * Name format patterns support the same token family used in Word's bibliography XSL:
 *   %F %M %L = full first/middle/last
 *   %f %m %l = initial first/middle/last (dot_initial appended by renderer)
 * The format string may contain literal spaces and punctuation.
 */
export const NameFormatSetSchema = z
  .object({
    FML: z.string(),
    FM: z.string(),
    ML: z.string(),
    FL: z.string(),
  })
  .strict();

export const LocaleNameFormatsSchema = z
  .object({
    citation_long: NameFormatSetSchema,
    citation_short: NameFormatSetSchema,
    bibliography_authors: NameFormatSetSchema,

    simple_author: z
      .object({
        F: z.string(),
        M: z.string(),
        L: z.string(),
      })
      .strict(),

    upper_last_default: YesNoSchema,
    with_dot_default: YesNoSchema,
  })
  .strict();

export type LocaleNameFormats = z.infer<typeof LocaleNameFormatsSchema>;

export const LocaleDateFormatsSchema = z
  .object({
    DMY: z.string(), // uses %D %M %Y
    DM: z.string(),
    MY: z.string(),
    DY: z.string(),
  })
  .strict();

export type LocaleDateFormats = z.infer<typeof LocaleDateFormatsSchema>;

export const LocaleSpecSchema = z
  .object({
    lcid: LcidSchema,
    culture: z.string().min(1),
    properties: LocalePropertiesSchema,
    strings: LocaleStringsSchema,
    name_formats: LocaleNameFormatsSchema,
    date_formats: LocaleDateFormatsSchema,
  })
  .strict();

export type LocaleSpec = z.infer<typeof LocaleSpecSchema>;

/** ===== Source-type rules ===== */

export const SourceTypeRulesSchema = z
  .object({
    source_type: SourceTypeSchema,

    // These are the raw field paths emitted by Word's GetImportantFields blocks.
    // We keep them verbatim for deterministic parity and easy diffing.
    important_fields: z.array(z.string().min(1)).min(1),

    // Derived from XSLT MainContributors template.
    main_contributor_priority: z.array(ContributorRoleSchema).min(1),

    // Render toggles
    supports_citation: z.boolean(),
    supports_bibliography: z.boolean(),
  })
  .strict();

export type SourceTypeRules = z.infer<typeof SourceTypeRulesSchema>;

/** ===== Render rules (engine-level behavior) ===== */

export const EtAlRulesSchema = z
  .object({
    // if author_count >= threshold => output first `position` authors then "and_others_uncap"
    threshold: z.number().int().min(2).max(99),
    position: z.number().int().min(1).max(10),
    and_others_string_key: z.literal("and_others_uncap"),
  })
  .strict();

export const RenderRulesSchema = z
  .object({
    max_author: z.number().int().min(1).max(99), // hard cap for rendering loops
    et_al: EtAlRulesSchema,

    // stable sorting
    sort: z
      .object({
        key: z.literal("sorting_string"),
        tie_breaker: z.literal("source_id"),
      })
      .strict(),
  })
  .strict();

export type RenderRules = z.infer<typeof RenderRulesSchema>;

/** ===== XSLT origin metadata ===== */

export const XsltOriginSchema = z
  .object({
    xslt_version: z.literal("1.0"),
    msxsl_node_set_required: z.boolean(),
    output_method: z.literal("html"),
    output_encoding: z.string().min(1),
    word_bibliography_version: z.string().min(1), // e.g. "2006.5.07"
    word_xsl_version: z.string().min(1),          // e.g. "2003"
    style_name_en: z.string().min(1),
  })
  .strict();

export type XsltOrigin = z.infer<typeof XsltOriginSchema>;

/** ===== StyleSpec ===== */

export const StyleSpecSchema = z
  .object({
    style_id: CanonicalIdSchema,
    style_version: SemverSchema,
    default_lcid: LcidSchema,
    origin: XsltOriginSchema,

    // LCID map keys are strings for JSON compatibility; schema enforces their numeric lcid inside each LocaleSpec.
    locales: z.record(z.string().regex(/^\d+$/), LocaleSpecSchema),

    // Source-type map
    source_types: z.record(SourceTypeSchema, SourceTypeRulesSchema),

    render_rules: RenderRulesSchema,
  })
  .strict();

export type StyleSpec = z.infer<typeof StyleSpecSchema>;

/** Utility: deterministic canonical key ordering note (enforced by your canonicalizer, not here). */
