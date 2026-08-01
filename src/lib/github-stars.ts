/**
 * Build-time GitHub star enrichment for catalogue entries.
 *
 * All repositories are fetched in one GraphQL request, rather than one REST request per
 * database. EleventyFetch keeps the validated result for a day and falls back to an
 * expired cache entry when GitHub is unavailable, so a transient API failure never blocks
 * the static build.
 */
import { createHash } from 'node:crypto';
import EleventyFetch from '@11ty/eleventy-fetch';
import { formatCompactCount } from './format-number';

interface DatabaseWithGithub {
  data: {
    slug: string;
    github_url?: string;
  };
}

interface Repository {
  key: string;
  owner: string;
  name: string;
  slugs: string[];
}

interface GraphqlResponse {
  data?: Record<string, { stargazerCount?: number } | null>;
  errors?: { message?: string }[];
}

const API_URL = 'https://api.github.com/graphql';
const CACHE_DIRECTORY = '.cache/github-stars';

let cached: Record<string, number> | undefined;

function repositoryFromUrl(githubUrl: string): Omit<Repository, 'slugs'> | null {
  try {
    const url = new URL(githubUrl);
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null;

    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts.length !== 2) return null;

    const owner = parts[0]!;
    const name = parts[1]!.replace(/\.git$/i, '');
    if (!owner || !name) return null;
    return { key: `${owner}/${name}`.toLowerCase(), owner, name };
  } catch {
    return null;
  }
}

function repositoriesFor(databases: Iterable<DatabaseWithGithub>): Repository[] {
  const repositories = new Map<string, Repository>();
  for (const database of databases) {
    if (!database.data.github_url) continue;
    const parsed = repositoryFromUrl(database.data.github_url);
    if (!parsed) continue;

    const existing = repositories.get(parsed.key);
    if (existing) {
      existing.slugs.push(database.data.slug);
    } else {
      repositories.set(parsed.key, { ...parsed, slugs: [database.data.slug] });
    }
  }
  return [...repositories.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function graphqlQuery(repositories: Repository[]): string {
  const fields = repositories.map(
    ({ owner, name }, index) =>
      `repo${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { stargazerCount }`
  );
  return `query GdbEngineStars {\n${fields.join('\n')}\n}`;
}

async function fetchRepositoryStars(repositories: Repository[]): Promise<Record<string, number>> {
  const token =
    process.env.GITHUB_STARS_TOKEN ?? process.env.RANKINGS_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'No GitHub token is configured (set GITHUB_STARS_TOKEN, RANKINGS_TOKEN, or GITHUB_TOKEN)'
    );
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'gdb-engines-build',
    },
    body: JSON.stringify({ query: graphqlQuery(repositories) }),
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as GraphqlResponse;
  if (!payload.data) {
    throw new Error(payload.errors?.[0]?.message ?? 'GitHub GraphQL response contained no data');
  }

  const stars: Record<string, number> = {};
  repositories.forEach((repository, index) => {
    const value = payload.data?.[`repo${index}`]?.stargazerCount;
    if (typeof value === 'number') stars[repository.key] = value;
  });
  if (Object.keys(stars).length === 0) {
    throw new Error(payload.errors?.[0]?.message ?? 'GitHub GraphQL response contained no star counts');
  }
  if (payload.errors?.length) {
    console.warn(`[github-stars] ${payload.errors.length} repositories could not be resolved.`);
  }
  return stars;
}

/** Return a catalogue slug -> stargazer count map. Missing values are deliberately absent. */
export async function loadGithubStars(
  databases: Iterable<DatabaseWithGithub>
): Promise<Record<string, number>> {
  if (cached) return cached;

  const repositories = repositoriesFor(databases);
  if (repositories.length === 0) return (cached = {});

  const fingerprint = createHash('sha256')
    .update(repositories.map((repository) => repository.key).join('\n'))
    .digest('hex')
    .slice(0, 16);

  try {
    const byRepository = (await EleventyFetch(
      () => fetchRepositoryStars(repositories),
      {
        requestId: `github-stars-${fingerprint}`,
        duration: '1d',
        type: 'json',
        directory: CACHE_DIRECTORY,
      }
    )) as Record<string, number>;

    const bySlug: Record<string, number> = {};
    for (const repository of repositories) {
      const value = byRepository[repository.key];
      if (typeof value !== 'number') continue;
      for (const slug of repository.slugs) bySlug[slug] = value;
    }
    return (cached = bySlug);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[github-stars] Star counts unavailable; continuing without them. ${message}`);
    return (cached = {});
  }
}

export function formatGithubStars(value: number): string {
  return formatCompactCount(value);
}
