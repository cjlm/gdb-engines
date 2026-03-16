import EleventyFetch from '@11ty/eleventy-fetch';

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
    if (defaultIcon.length > 0 && buffer.equals(defaultIcon)) {
      return null;
    }
    // Reject GitHub's own favicon (octocat) — sites hosted on github.com
    const ghIcon = await getGitHubFavicon();
    if (ghIcon.length > 0 && buffer.equals(ghIcon)) {
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

export async function fetchFavicon(url: string, githubUrl?: string): Promise<FaviconResult> {
  const toDataUri = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`;

  try {
    const hostname = new URL(url).hostname;
    const googleFavicon = await fetchGoogleFavicon(hostname);
    if (googleFavicon) return { url: toDataUri(googleFavicon), source: 'site' };
  } catch {
    // Invalid URL — skip Google favicon lookup
  }

  if (githubUrl) {
    const ghAvatar = await fetchGitHubAvatar(githubUrl);
    if (ghAvatar) return { url: toDataUri(ghAvatar), source: 'github' };
  }

  return { url: '/favicon.svg', source: 'fallback' };
}
