import type { CollectionEntry } from 'astro:content';

type Database = CollectionEntry<'databases'>;
type LineageRelation = NonNullable<Database['data']['lineage']>[string]['relation'];
export type Relation = LineageRelation | 'renamed';

export interface ParentLink {
  id: string;
  relation: Relation;
}

/** One stop on a line: a catalogue entry, one of its former names, or an uncatalogued ancestor. */
export interface Station {
  id: string;
  label: string;
  kind: 'current' | 'former' | 'external';
  /** Catalogue entry the station belongs to. Undefined for external ancestors. */
  slug?: string;
  /** Release date as a fractional year, used to order stations left to right. */
  when?: number;
  released?: string;
  /** Set on a current station whose engine is no longer developed. */
  ended?: boolean;
  parents: ParentLink[];
}

export interface Family {
  /** Id of the family's earliest root station, stable across builds. */
  id: string;
  title: string;
  stations: Station[];
}

export const RELATION_LABELS: Record<Relation, string> = {
  renamed: 'renamed',
  fork: 'fork',
  'based-on': 'based on',
  successor: 'successor',
  'inspired-by': 'inspired by',
  'borrows-from': 'borrows code',
};

/** Relations phrased to precede the parent's name: "fork of Titan", "successor to graphd". */
export const RELATION_PHRASES: Record<Relation, string> = {
  renamed: 'renamed from',
  fork: 'fork of',
  'based-on': 'based on',
  successor: 'successor to',
  'inspired-by': 'inspired by',
  'borrows-from': 'borrows code from',
};

function fractionalYear(released: string | undefined): number | undefined {
  if (!released) return undefined;
  const [year, month] = released.split('-').map(Number);
  return year + ((month ?? 1) - 1) / 12;
}

/** Former names followed by the current one, each linked to the one before. */
function productStations(db: Database): Station[] {
  const { slug, name, released, status, previous_names: previous = [] } = db.data;
  const labels = [...previous, name];
  return labels.map((label, i) => ({
    id: i === labels.length - 1 ? slug : `${slug}~${i}`,
    label,
    kind: i === labels.length - 1 ? 'current' : 'former',
    slug,
    ...(i === 0 && { when: fractionalYear(released), released }),
    ...(i === labels.length - 1 && status !== 'active' && { ended: true }),
    parents: i === 0 ? [] : [{ id: `${slug}~${i - 1}`, relation: 'renamed' as const }],
  }));
}

function findRoot(unions: Map<string, string>, id: string): string {
  let current = id;
  while (unions.get(current) !== current) current = unions.get(current)!;
  return current;
}

function stationsFor(databases: Database[]): Map<string, Station> {
  const parentSlugs = new Set(databases.flatMap((db) => Object.keys(db.data.lineage ?? {})));
  const stations = new Map<string, Station>();
  for (const db of databases) {
    const { lineage = {}, previous_names: previous = [], slug } = db.data;
    if (!previous.length && !Object.keys(lineage).length && !parentSlugs.has(slug)) continue;

    const own = productStations(db);
    for (const [key, parent] of Object.entries(lineage)) {
      const id = parent.name ? `ext:${key}` : key;
      if (parent.name && !stations.has(id)) {
        stations.set(id, { id, label: parent.name, kind: 'external', parents: [] });
      }
      own[0].parents.push({ id, relation: parent.relation });
    }
    for (const station of own) stations.set(station.id, station);
  }
  return stations;
}

/**
 * Groups every engine with a rename or a recorded ancestor into families: connected graphs of
 * stations, largest first. Engines with no history on either side are left out.
 */
export function buildFamilies(databases: Database[]): Family[] {
  const stations = stationsFor(databases);

  const unions = new Map([...stations.keys()].map((id) => [id, id]));
  for (const station of stations.values()) {
    for (const parent of station.parents) {
      unions.set(findRoot(unions, station.id), findRoot(unions, parent.id));
    }
  }

  const grouped = new Map<string, Station[]>();
  for (const station of stations.values()) {
    const root = findRoot(unions, station.id);
    grouped.set(root, [...(grouped.get(root) ?? []), station]);
  }

  const families: Family[] = [];
  for (const members of grouped.values()) {
    if (members.length < 2) continue;
    const roots = members
      .filter((s) => s.parents.length === 0)
      .sort((a, b) => (a.when ?? 0) - (b.when ?? 0));
    const rootTitle = (root: Station) =>
      members.find((s) => s.kind === 'current' && s.slug === root.slug)?.label ?? root.label;
    families.push({
      id: roots[0].slug ?? roots[0].id.replace('ext:', ''),
      title: roots.map(rootTitle).join(' & '),
      stations: members,
    });
  }
  return families.sort((a, b) => b.stations.length - a.stations.length || a.title.localeCompare(b.title));
}

export function familyOf(families: Family[], slug: string): Family | undefined {
  return families.find((family) => family.stations.some((s) => s.slug === slug));
}
