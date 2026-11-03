/** The site's --color-brand-accent in each theme (src/styles/global.css). */
export const BRAND_ACCENT = { light: '#a73752', dark: '#e8a4b5' };

/** Draw an embed's selection and other canvas marks in the site's accent, per theme. */
export function setEmbedAccent(embedUrl) {
  embedUrl.searchParams.set('accent', BRAND_ACCENT.light);
  embedUrl.searchParams.set('accentDark', BRAND_ACCENT.dark);
}

/** Clone a generated graph document and align its saved view with the host. */
export function prepareGarphieldDocument(source, theme) {
  const document = structuredClone(source);
  if (document.config?.current?.state) {
    document.config.current.state.theme = theme;
  }
  return document;
}
