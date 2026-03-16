# gdb-engines.com

An Open Source comparison of graph database features and capabilities.

## Overview

A comprehensive comparison table covering 80+ graph databases, query engines, extensions, and other graph technologies. Each entry includes metadata like vendor, license, query language support, and status. Many entries are also scored across 43 features based on criteria from academic research.

## Data format

Each database is a TOML file in `src/content/databases/`. At minimum, a file needs:

```toml
name = "Example DB"
vendor = "Example Inc"
slug = "example-db"
description = "A graph database..."
url = "https://example.com"
github_url = "https://github.com/example/example-db"
license = "Apache-2.0"
type = "Property Graph"
query_languages = ["openCypher", "Gremlin"]
category = "Emerging"
gdotv_support = false
```

**Field reference:**
- `type` — one of `Property Graph`, `RDF`, `Multiple`, or `Other`
- `category` — one of `Established`, `Enterprise`, or `Emerging`
- `kind` — one of `database` (default), `extension`, `query-engine`, or `embedded`
- `status` — one of `active` (default), `inactive`, or `deprecated`
- `status_note` — explanation for non-active status
- `query_languages` — array of supported query languages (e.g. `["openCypher", "SPARQL"]`)
- `previous_vendors` — ordered array of previous vendor names, oldest first
- `license` — SPDX identifier (e.g. `Apache-2.0`, `MIT`, `Proprietary`)
- `gdotv_support` — whether the database is supported by G.V()
- `icon` — optional custom favicon filename in `public/logos/`

Databases that have been scored in the research paper also include a `[features]` section with 43 feature scores (each a value of `0`, `0.5`, or `1`).

## Contributing

1. Fork this repository
2. Add a new TOML file in `src/content/databases/` or edit an existing one
3. Submit a pull request

The `[features]` section is optional for new databases that have not been scored in the research paper. If you're adding a new database, you can start with just the top-level fields.

## API

The full dataset is available as JSON:

```bash
curl https://gdb-engines.com/api.json
```

## Local development

```bash
npm install
npm run dev    # http://localhost:4321
npm run build  # static output to dist/
```

## Acknowledgements

- Coimbra, M. E., Svitakova, L., Francisco, A. P., & Veiga, L. (2025). "Survey: Graph Databases." arXiv:2505.24758
- [models.dev](https://models.dev) by SST for the UI pattern
