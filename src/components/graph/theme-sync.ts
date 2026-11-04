export type ColorScheme = 'light' | 'dark';

const systemScheme = window.matchMedia('(prefers-color-scheme: dark)');

/** The site's theme: the reader's explicit choice, otherwise the system preference. */
export function effectiveTheme(): ColorScheme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return systemScheme.matches ? 'dark' : 'light';
}

/**
 * Call `onChange` whenever the effective theme may have changed: the theme toggle sets
 * `data-theme` on the root element, and the system preference applies when it is unset.
 *
 * Returns:
 *   A function that stops watching.
 */
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  const handleSystemChange = () => {
    if (!document.documentElement.dataset.theme) onChange();
  };
  systemScheme.addEventListener('change', handleSystemChange);
  return () => {
    observer.disconnect();
    systemScheme.removeEventListener('change', handleSystemChange);
  };
}
