/**
 * Value-by-value evidence for list fields.
 *
 * `protocols` is evidenced as a whole: one claim, several sources, and the list stands or falls
 * together. `kg_kinds` and `kg_capabilities` are checked one value at a time instead, because each
 * value is a separate assertion about the product ("ships SHACL validation", "ships an OWL
 * reasoner") and one good quote for SPARQL says nothing about the reasoner. Each source names the
 * value it backs in `supports`.
 */

export const PER_VALUE_FIELDS = ['kg_kinds', 'kg_capabilities', 'kg_extension_capabilities'];

const PUBLISHED = new Set(['matched', 'matched-archive']);

/**
 * The values in `claim.value` with no source backing them. With `publishedOnly`, a source counts
 * only once verify-quotes.mjs has matched its quote.
 */
export function unsupportedValues(claim, { publishedOnly = false } = {}) {
  const backed = new Set(
    (claim.sources ?? [])
      .filter((s) => !publishedOnly || PUBLISHED.has(s.verified))
      .map((s) => s.supports),
  );
  return (claim.value ?? []).filter((v) => !backed.has(v));
}
