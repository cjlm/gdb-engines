import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

/** Public posts, newest first. Drafts remain visible while running the local dev server. */
export async function blogPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !(import.meta.env.PROD && data.draft));
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString('en-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
