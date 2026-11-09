/**
 * Similarity between catalogue entries, for the similarity map.
 *
 * Each engine is described by six fields: data model, kind, whether it runs embedded,
 * implementation language, query languages and protocols. Two engines score the average of their
 * per-field similarities, so each field gets an equal say (a Gower similarity):
 *
 * - Single-valued fields score 1 when they match and 0 when they don't.
 * - Query languages and protocols score a weighted Jaccard index of the two lists, each value
 *   weighted by how rare it is in the catalogue (its information content): sharing a niche query
 *   language says more than sharing openCypher.
 * - A field either engine doesn't record scores the catalogue's average for that field. Counting
 *   it as a difference penalised every embedded engine for listing no network protocol; leaving
 *   it out let entries with little metadata match anything on the few fields they do record.
 *
 * Metadata this coarse still leaves many exact ties, so ties are broken by how alike the two
 * catalogue descriptions read, and only then by slug.
 */

import { canonicalQueryLanguage } from '../../src/lib/query-languages.mjs';

const FIELDS = ['type', 'kind', 'embeddable', 'implementation', 'query', 'protocol'];

/** The tokens an engine contributes per field, or null for a field it doesn't record. */
export function fieldTokens(database) {
  const tokens = {
    type: [database.type],
    kind: [database.kind],
    embeddable: typeof database.embeddable === 'boolean' ? [String(database.embeddable)] : null,
    implementation: database.implementationLanguage ? [database.implementationLanguage] : null,
    query: database.queryLanguages.length > 0
      ? database.queryLanguages.map(canonicalQueryLanguage)
      : null,
    protocol: database.protocols.length > 0 ? database.protocols : null,
  };
  const out = {};
  for (const field of FIELDS) {
    out[field] = tokens[field]
      ? new Set(tokens[field].map((value) => `${field}:${value}`.toLocaleLowerCase()))
      : null;
  }
  return out;
}

/** Information content of each token: log((n + 1) / (engines carrying it + 1)). */
export function tokenWeights(tokenSets) {
  const counts = new Map();
  for (const fields of tokenSets) {
    for (const set of Object.values(fields)) {
      for (const token of set ?? []) counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const n = tokenSets.length;
  return new Map([...counts].map(([token, count]) => [token, Math.log((n + 1) / (count + 1))]));
}

/**
 * Weighted Jaccard index of two value sets. A value every engine carries has no weight, so when
 * nothing in the pair carries any, this falls back to the unweighted index.
 */
function fieldSimilarity(left, right, weights) {
  const union = new Set([...left, ...right]);
  let shared = 0;
  let total = 0;
  let sharedCount = 0;
  for (const token of union) {
    const weight = weights.get(token) ?? 0;
    total += weight;
    if (left.has(token) && right.has(token)) {
      shared += weight;
      sharedCount += 1;
    }
  }
  return total > 0 ? shared / total : sharedCount / union.size;
}

/** Each field's average similarity over the pairs of engines that both record it. */
export function fieldMeans(tokenSets, weights) {
  const means = {};
  for (const field of FIELDS) {
    let sum = 0;
    let count = 0;
    for (let left = 0; left < tokenSets.length; left += 1) {
      for (let right = left + 1; right < tokenSets.length; right += 1) {
        const [a, b] = [tokenSets[left][field], tokenSets[right][field]];
        if (!a || !b) continue;
        sum += fieldSimilarity(a, b, weights);
        count += 1;
      }
    }
    means[field] = count > 0 ? sum / count : 0;
  }
  return means;
}

/** Average of the per-field similarities, with an unrecorded field scoring its catalogue mean. */
export function similarity(left, right, weights, means) {
  let sum = 0;
  for (const field of FIELDS) {
    sum += left[field] && right[field]
      ? fieldSimilarity(left[field], right[field], weights)
      : means[field];
  }
  return sum / FIELDS.length;
}

const STOP_WORDS = new Set(
  ('a an the and or of for to in on with by as is are be its it that this from at into via ' +
    'over under using built based which can also up while than then their them they has have')
    .split(' '),
);

function words(text) {
  return text
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * TF-IDF vectors of the catalogue descriptions, used only to break ties.
 *
 * Single-word engine and vendor names are removed first: two forks that both say "a fork of Kuzu"
 * would otherwise read alike through the name alone, which is what the lineage links are for.
 * Words of multi-word names stay, since "RDF" in "Duck RDF" still describes the engine.
 * Terms in a single description or in more than half of them carry no comparison and are dropped.
 */
export function descriptionVectors(databases) {
  const singleWordNames = databases.flatMap((database) =>
    database.names.map(words).filter((parts) => parts.length === 1));
  const names = new Set(singleWordNames.flat());
  const documents = databases.map((database) =>
    words(database.description).filter((word) => !names.has(word)));
  const frequency = new Map();
  for (const terms of documents) {
    for (const term of new Set(terms)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const n = documents.length;
  return documents.map((terms) => {
    const counts = new Map();
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
    const vector = new Map();
    for (const [term, count] of counts) {
      const df = frequency.get(term);
      if (df < 2 || df > n / 2) continue;
      vector.set(term, (1 + Math.log(count)) * Math.log(n / df));
    }
    const norm = Math.hypot(...vector.values()) || 1;
    for (const [term, value] of vector) vector.set(term, value / norm);
    return vector;
  });
}

export function cosine(left, right) {
  let sum = 0;
  for (const [term, value] of left) sum += value * (right.get(term) ?? 0);
  return sum;
}

/** Every pair of engines, each with its similarity and description tie-breaker. */
export function scorePairs(databases) {
  const tokens = databases.map(fieldTokens);
  const weights = tokenWeights(tokens);
  const means = fieldMeans(tokens, weights);
  const vectors = descriptionVectors(databases);
  const pairs = [];
  for (let left = 0; left < databases.length; left += 1) {
    for (let right = left + 1; right < databases.length; right += 1) {
      pairs.push({
        source: databases[left].slug,
        target: databases[right].slug,
        similarity: similarity(tokens[left], tokens[right], weights, means),
        description: cosine(vectors[left], vectors[right]),
      });
    }
  }
  return pairs;
}

/** The `count` most similar pairs that involve `slug`, ties broken by description then slug. */
export function nearest(pairs, slug, count) {
  return pairs
    .filter((pair) => pair.source === slug || pair.target === slug)
    .sort(
      (a, b) =>
        b.similarity - a.similarity ||
        b.description - a.description ||
        a.source.localeCompare(b.source) ||
        a.target.localeCompare(b.target),
    )
    .slice(0, count);
}
