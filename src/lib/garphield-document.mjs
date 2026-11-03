/**
 * Clone a generated graph document and align its saved view with the host.
 *
 * `style` overrides the saved view's mark style (e.g. `nodeSize`, `linkWidth`). The embed's own
 * size and width URL parameters are reset whenever a document is applied, so this is where a
 * host sets them.
 */
export function prepareGarphieldDocument(source, theme, style = {}) {
  const document = structuredClone(source);
  const state = document.config?.current?.state;
  if (state) {
    state.theme = theme;
    state.style = { ...state.style, ...style };
  }
  return document;
}
