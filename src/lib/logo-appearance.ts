/* A few transparent vendor marks are drawn mostly in black or very dark ink and
   disappear against the dark theme. Keep the light tile opt-in so logos with
   enough contrast can sit directly on the page background. */
const lightBackfillLogos = new Set([
  'eclipse-rdf4j.png',
  'faunadb.svg',
  'frogql.png',
  'gstore.png',
  'helixdb.png',
  'janusgraph.png',
  'neo4j.png',
]);

export function needsLightLogoBackfill(src: string): boolean {
  const path = src.split(/[?#]/, 1)[0];
  const filename = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  return lightBackfillLogos.has(filename);
}
