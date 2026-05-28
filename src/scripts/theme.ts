/**
 * Theme toggle. Wires the #theme-toggle button (when present) and applies the saved
 * theme on every page load before paint. Imported by Layout so all pages get it.
 */

function applyTheme(theme: string | null): void {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  }
  const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/png"]').forEach((link) => {
    link.href = link.href.replace(isDark ? '.png' : '-dark.png', isDark ? '-dark.png' : '.png');
  });
}

function getEffectiveTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) applyTheme(savedTheme);

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    applyTheme(getEffectiveTheme() === 'dark' ? 'light' : 'dark');
  });
}
