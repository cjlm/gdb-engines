import EleventyFetch from '@11ty/eleventy-fetch';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOGOS_DIR = join(process.cwd(), 'public', 'logos');
if (!existsSync(LOGOS_DIR)) {
  mkdirSync(LOGOS_DIR, { recursive: true });
}

// Fetch known default favicons once for comparison
let defaultFaviconBytes: Buffer | null = null;
let githubFaviconBytes: Buffer | null = null;

async function getDefaultFavicon(): Promise<Buffer> {
  if (!defaultFaviconBytes) {
    try {
      defaultFaviconBytes = await EleventyFetch(
        'https://www.google.com/s2/favicons?sz=32&domain=this-domain-does-not-exist-xyz123.invalid',
        { duration: '30d', type: 'buffer', directory: '.cache/favicons' }
      );
    } catch {
      defaultFaviconBytes = Buffer.alloc(0);
    }
  }
  return defaultFaviconBytes;
}

async function getGitHubFavicon(): Promise<Buffer> {
  if (!githubFaviconBytes) {
    try {
      githubFaviconBytes = await EleventyFetch(
        'https://www.google.com/s2/favicons?sz=32&domain=github.com',
        { duration: '30d', type: 'buffer', directory: '.cache/favicons' }
      );
    } catch {
      githubFaviconBytes = Buffer.alloc(0);
    }
  }
  return githubFaviconBytes;
}

async function fetchGoogleFavicon(hostname: string): Promise<Buffer | null> {
  try {
    const buffer = await EleventyFetch(
      `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`,
      { duration: '30d', type: 'buffer', directory: '.cache/favicons' }
    );
    const defaultIcon = await getDefaultFavicon();
    const isDefault = defaultIcon.length > 0 && buffer.equals(defaultIcon);
    const ghIcon = await getGitHubFavicon();
    const isGithub = ghIcon.length > 0 && buffer.equals(ghIcon);
    if (isDefault || isGithub) {
      return null;
    }
    return buffer;
  } catch {
    return null;
  }
}

async function fetchGitHubAvatar(githubUrl: string): Promise<Buffer | null> {
  try {
    const org = new URL(githubUrl).pathname.split('/').filter(Boolean)[0];
    if (!org) return null;
    return await EleventyFetch(`https://github.com/${org}.png?size=32`, {
      duration: '30d',
      type: 'buffer',
      directory: '.cache/favicons',
    });
  } catch {
    return null;
  }
}

export interface FaviconResult {
  url: string;
  source: 'site' | 'github' | 'custom' | 'fallback';
}

function saveToFile(slug: string, buf: Buffer): string {
  const filename = `${slug}.png`;
  writeFileSync(join(LOGOS_DIR, filename), buf);
  return `/logos/${filename}`;
}

export async function fetchFavicon(slug: string, url: string, githubUrl?: string): Promise<FaviconResult> {
  // Use committed/prebuild PNG if available
  const logoPath = join(LOGOS_DIR, `${slug}.png`);
  if (existsSync(logoPath)) {
    return { url: `/logos/${slug}.png`, source: 'site' };
  }

  // Fallback: fetch at build time and save to public/logos/ for Astro to copy
  try {
    const hostname = new URL(url).hostname;
    const googleFavicon = await fetchGoogleFavicon(hostname);
    if (googleFavicon) return { url: saveToFile(slug, googleFavicon), source: 'site' };
  } catch {
    // Invalid URL
  }

  if (githubUrl) {
    const ghAvatar = await fetchGitHubAvatar(githubUrl);
    if (ghAvatar) return { url: saveToFile(slug, ghAvatar), source: 'github' };
  }

  return { url: '/favicon.svg', source: 'fallback' };
}
