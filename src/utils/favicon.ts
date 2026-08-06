import EleventyFetch from '@11ty/eleventy-fetch';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOGOS_DIR = join(process.cwd(), 'public', 'logos');
const FAVICON_SIZE = 128;
const MIN_CACHED_LOGO_SIZE = 64;
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
        `https://www.google.com/s2/favicons?sz=${FAVICON_SIZE}&domain=this-domain-does-not-exist-xyz123.invalid`,
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
        `https://www.google.com/s2/favicons?sz=${FAVICON_SIZE}&domain=github.com`,
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
      `https://www.google.com/s2/favicons?sz=${FAVICON_SIZE}&domain=${hostname}`,
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
    return await EleventyFetch(`https://github.com/${org}.png?size=${FAVICON_SIZE}`, {
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

function rasterSize(buffer: Buffer): { width: number; height: number } | null {
  if (
    buffer.length >= 24 &&
    buffer.toString('hex', 0, 8) === '89504e470d0a1a0a'
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame && offset + 7 <= buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }
    if (segmentLength < 2) break;
    offset += segmentLength;
  }
  return null;
}

function longestRasterSide(buffer: Buffer): number {
  const size = rasterSize(buffer);
  return size ? Math.max(size.width, size.height) : 0;
}

export async function fetchFavicon(slug: string, url: string, githubUrl?: string): Promise<FaviconResult> {
  // Keep custom/high-resolution prebuild PNGs, but refresh the old 32px cache entries.
  const logoPath = join(LOGOS_DIR, `${slug}.png`);
  if (existsSync(logoPath)) {
    try {
      if (longestRasterSide(readFileSync(logoPath)) >= MIN_CACHED_LOGO_SIZE) {
        return { url: `/logos/${slug}.png`, source: 'site' };
      }
    } catch {
      // Re-fetch unreadable cache entries below.
    }
  }

  // Fallback: fetch at build time and save to public/logos/ for Astro to copy
  let googleFavicon: Buffer | null = null;
  try {
    const hostname = new URL(url).hostname;
    googleFavicon = await fetchGoogleFavicon(hostname);
  } catch {
    // Invalid URL
  }

  if (githubUrl) {
    const ghAvatar = await fetchGitHubAvatar(githubUrl);
    if (
      ghAvatar &&
      (!googleFavicon || longestRasterSide(ghAvatar) > longestRasterSide(googleFavicon))
    ) {
      return { url: saveToFile(slug, ghAvatar), source: 'github' };
    }
  }

  if (googleFavicon) return { url: saveToFile(slug, googleFavicon), source: 'site' };

  return { url: '/favicon.svg', source: 'fallback' };
}
