import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";

const SOURCE_DIR = "src/content/databases";
const OUTPUT_DIR = "public/graphs";
const SITE_ORIGIN = (
  process.env.PUBLIC_SITE_ORIGIN ?? "https://gdb-engines.com"
).replace(/\/+$/, "");

const files = (await readdir(SOURCE_DIR))
  .filter((file) => file.endsWith(".toml"))
  .sort();
const databases = await Promise.all(
  files.map(async (file) => {
    const data = parse(await readFile(join(SOURCE_DIR, file), "utf8"));
    return {
      slug: String(data.slug),
      name: String(data.name),
      type: String(data.type),
      kind: String(data.kind ?? "database"),
      category: String(data.category),
      status: String(data.status ?? "active"),
      license: data.license ? String(data.license) : null,
      implementationLanguage: data.implementation_language
        ? String(data.implementation_language)
        : null,
      queryLanguages: Array.isArray(data.query_languages)
        ? data.query_languages.map(String)
        : [],
    };
  }),
);

function document(name, nodes, links, config) {
  return {
    info: { version: 1, name },
    datasets: [
      {
        id: "main",
        graph: {
          directed: false,
          multigraph: false,
          graph: { name },
          nodes,
          links,
        },
      },
    ],
    config,
  };
}

const sizeByDegree = {
  channel: "size",
  source: { kind: "algorithm", id: "degree" },
  resultType: "num",
};

const imageByUrl = {
  channel: "image",
  source: { kind: "field", id: "image" },
  resultType: "cat",
};

const hullByType = {
  channel: "hull",
  source: { kind: "field", id: "type" },
  resultType: "cat",
  enabled: false,
};

function databaseNode(database) {
  return {
    id: `db:${database.slug}`,
    label: database.name,
    image: `${SITE_ORIGIN}/logos/${encodeURIComponent(database.slug)}.png`,
  };
}

function bipartiteDocument() {
  const languageNames = [
    ...new Set(databases.flatMap((database) => database.queryLanguages)),
  ].sort();
  const nodes = [
    ...databases.map((database) => ({
      ...databaseNode(database),
      kind: "Database",
      type: database.type,
      category: database.category,
      status: database.status,
    })),
    ...languageNames.map((language) => ({
      id: `language:${language}`,
      label: language,
      kind: "Query language",
    })),
  ];
  const links = databases.flatMap((database) =>
    database.queryLanguages.map((language) => ({
      source: `db:${database.slug}`,
      target: `language:${language}`,
      relationship: "supports",
    })),
  );

  return document("Databases × query languages", nodes, links, {
    version: 1,
    layout: "force",
    bindings: [
      sizeByDegree,
      imageByUrl,
      hullByType,
      {
        channel: "color",
        source: { kind: "field", id: "kind" },
        resultType: "cat",
      },
    ],
  });
}

function featureTokens(database) {
  const tokens = [
    `type:${database.type}`,
    `kind:${database.kind}`,
    `category:${database.category}`,
  ];
  if (database.license) tokens.push(`license:${database.license}`);
  if (database.implementationLanguage) {
    tokens.push(`implementation:${database.implementationLanguage}`);
  }
  for (const language of database.queryLanguages) {
    tokens.push(`query:${language}`);
  }
  return new Set(tokens.map((token) => token.toLocaleLowerCase()));
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function similarityDocument() {
  const tokens = new Map(
    databases.map((database) => [database.slug, featureTokens(database)]),
  );
  const candidates = [];
  for (let left = 0; left < databases.length; left += 1) {
    for (let right = left + 1; right < databases.length; right += 1) {
      const source = databases[left];
      const target = databases[right];
      candidates.push({
        source: source.slug,
        target: target.slug,
        similarity: jaccard(tokens.get(source.slug), tokens.get(target.slug)),
      });
    }
  }

  const links = new Map();
  for (const database of databases) {
    const nearest = candidates
      .filter(
        (candidate) =>
          candidate.source === database.slug ||
          candidate.target === database.slug,
      )
      .sort(
        (a, b) =>
          b.similarity - a.similarity ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target),
      )
      .slice(0, 3);
    for (const edge of nearest) {
      const key = `${edge.source}\0${edge.target}`;
      links.set(key, {
        source: `db:${edge.source}`,
        target: `db:${edge.target}`,
        similarity: Number(edge.similarity.toFixed(4)),
      });
    }
  }

  const nodes = databases.map((database) => ({
    ...databaseNode(database),
    type: database.type,
    kind: database.kind,
    category: database.category,
    status: database.status,
    license: database.license,
    implementationLanguage: database.implementationLanguage,
    queryLanguages: database.queryLanguages.join(", "),
  }));

  return document("Database similarity", nodes, [...links.values()], {
    version: 1,
    layout: "force",
    bindings: [
      sizeByDegree,
      imageByUrl,
      hullByType,
      {
        channel: "color",
        source: { kind: "field", id: "type" },
        resultType: "cat",
      },
      {
        channel: "edgeWidth",
        source: { kind: "field", id: "similarity", target: "edge" },
        resultType: "num",
      },
    ],
  });
}

await mkdir(OUTPUT_DIR, { recursive: true });
const outputs = [
  ["databases-languages.gfd", bipartiteDocument()],
  ["databases-similarity.gfd", similarityDocument()],
];
for (const [filename, graph] of outputs) {
  await writeFile(
    join(OUTPUT_DIR, filename),
    `${JSON.stringify(graph, null, 2)}\n`,
  );
  console.log(
    `${filename}: ${graph.datasets[0].graph.nodes.length} nodes, ${graph.datasets[0].graph.links.length} edges`,
  );
}
