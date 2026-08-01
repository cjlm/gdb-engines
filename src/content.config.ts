import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { PROTOCOLS } from './lib/protocols';

const featureScore = z.number().min(0).max(1);

const databases = defineCollection({
  loader: glob({ pattern: '**/*.toml', base: './src/content/databases' }),
  schema: z.object({
    name: z.string().min(1),
    vendor: z.string().optional(),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    description: z.string(),
    url: z.string().url().optional(),
    github_url: z.string().url().optional(),
    license: z.string().optional(),
    implementation_language: z.string().optional(),
    type: z.enum(['Property Graph', 'RDF', 'Multiple', 'Other']),
    kind: z.enum(['database', 'extension', 'query-engine', 'embedded', 'library']).default('database'),
    category: z.enum(['Established', 'Enterprise', 'Growing', 'Emerging']),
    status: z.enum(['active', 'inactive', 'deprecated']).default('active'),
    status_note: z.string().optional(),
    previous_vendors: z.array(z.string()).optional(),
    previous_names: z.array(z.string()).optional(),
    released: z.string().regex(/^\d{4}(-\d{2})?$/).optional(),
    query_languages: z.array(z.string()).optional(),
    // Closed vocabulary — see src/lib/protocols.ts for why this differs from query_languages.
    protocols: z.array(z.enum(PROTOCOLS)).nonempty().optional(),
    icon: z.string().optional(),
    gdotv_support: z.boolean(),
    gdotv_url: z.string().url().optional(),
    features: z.object({
      active_development: featureScore,
      commercial_support: featureScore,
      live_community: featureScore,
      open_source: featureScore,
      pricing: featureScore,
      trendiness: featureScore,
      containerization: featureScore,
      work_as_dedicated_instance: featureScore,
      work_as_embedded: featureScore,
      testing_in_memory_version: featureScore,
      operating_on_linux: featureScore,
      operating_on_windows: featureScore,
      saas_offering: featureScore,
      automatic_updates: featureScore,
      client_side_caching: featureScore,
      data_versioning_support: featureScore,
      live_backups: featureScore,
      cluster_rebalancing: featureScore,
      data_distribution: featureScore,
      high_availability: featureScore,
      query_distribution: featureScore,
      replication_support: featureScore,
      data_types_defined: featureScore,
      logging_auditing: featureScore,
      object_graph_mapper: featureScore,
      reactive_programming: featureScore,
      documentation_up_to_date: featureScore,
      binary_protocol: featureScore,
      cli: featureScore,
      gui: featureScore,
      multi_database: featureScore,
      graph_native_data: featureScore,
      rest_api: featureScore,
      query_language: featureScore,
      granular_locking: featureScore,
      multiple_isolation_levels: featureScore,
      read_committed_transaction: featureScore,
      transaction_support: featureScore,
      constraints: featureScore,
      schema_support: featureScore,
      secondary_indexes: featureScore,
      server_side_procedures: featureScore,
      triggers: featureScore,
      authentication: featureScore,
      authorization: featureScore,
      data_encryption: featureScore,
    }).optional(),
  }),
});

/**
 * Curated multi-way comparisons over catalogue segments. Hand-maintained rather than
 * generated per field value: auto-generating one per value would produce ~60 pages, most of
 * them slices with 1–4 members. Bad entries fail the build rather than shipping.
 */
const roundups = defineCollection({
  loader: glob({ pattern: '**/*.toml', base: './src/content/roundups' }),
  schema: z.object({
    // `-vs-` is the pair-URL separator; a roundup carrying it would be ambiguous.
    slug: z.string().regex(/^[a-z0-9-]+$/).refine((s) => !s.includes('-vs-'), {
      message: 'Roundup slug must not contain "-vs-" — that token is reserved for pair pages.',
    }),
    title: z.string().min(1),
    h1: z.string().min(1),
    lede: z.string().min(1),
    filter: z.object({
      type: z.array(z.string()).optional(),
      kind: z.array(z.string()).optional(),
      category: z.array(z.string()).optional(),
      license: z.array(z.string()).optional(),
      license_not: z.array(z.string()).optional(),
      query_languages: z.array(z.string()).optional(),
      implementation_language: z.array(z.string()).optional(),
    }),
    include: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([]),
    ranking_board: z.string().default(''),
  })
    // The h1 and lede are the text a reader actually sees; checking only `title` let the
    // ranking boards' vocabulary in through the front door (§3.1).
    .refine((r) => ![r.title, r.h1, r.lede].some((t) => /ranking|popularity|top |most popular/i.test(t)), {
      message: 'Roundup title, h1 and lede must not use the ranking boards’ vocabulary (§3.1).',
    })
    // `/compare/custom/` is the builder and `/compare/` is the hub; a roundup claiming
    // either slug would silently shadow a real route.
    .refine((r) => !['custom', 'index'].includes(r.slug), {
      message: 'Roundup slug “custom” and “index” are reserved by the /compare/ routes.',
    }),
});

/**
 * Sources backing individual catalogue values, one file per database entry.
 *
 * Kept alongside the entry rather than inside it so the catalogue TOML stays readable, and so a
 * value and its evidence can be diffed separately in review. `scripts/check-evidence.mjs` runs in
 * `prebuild` and fails the build if a claim's `value` no longer matches the entry it describes —
 * editing a fact without revisiting its sources is the way this data goes stale silently.
 *
 * `quote` is a verbatim substring of the cited page. `scripts/verify-quotes.mjs` refetches each
 * URL and confirms the quote is really there, which is what separates a source from an assertion
 * that a source exists.
 */
const evidence = defineCollection({
  loader: glob({ pattern: '**/*.toml', base: './src/content/evidence' }),
  schema: z.object({
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    claims: z.array(z.object({
      field: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      confidence: z.enum(['high', 'medium', 'low']),
      // How the value was established, in descending order of trust.
      method: z.enum(['api', 'repo', 'vendor-docs', 'web']),
      checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string().optional(),
      sources: z.array(z.object({
        url: z.string().url(),
        title: z.string().min(1),
        quote: z.string().min(1),
        // Written by verify-quotes.mjs, never by hand. `matched-archive` means the original
        // wouldn't load but an Internet Archive snapshot carries the quote.
        verified: z.enum(['matched', 'matched-archive', 'mismatch', 'unreachable', 'unchecked'])
          .default('unchecked'),
        archive_url: z.string().url().optional(),
        checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })).default([]),
    })).min(1),
  }),
});

export const collections = { databases, roundups, evidence };
