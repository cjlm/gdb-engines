/**
 * Canonical query-language labels, so variant spellings resolve to the same ranking board, badge,
 * comparison and similarity score. `openCypher` → `Cypher`; `ISO GQL` → `GQL` (the ISO/IEC 39075
 * standard name). This is the single normalization point for query-language labels; keep it in
 * sync with the rankings collector.
 */
const QUERY_LANGUAGE_ALIASES = {
  openCypher: 'Cypher',
  'ISO GQL': 'GQL',
};

/** @param {string} label */
export const canonicalQueryLanguage = (label) => QUERY_LANGUAGE_ALIASES[label] ?? label;
