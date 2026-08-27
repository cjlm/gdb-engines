/** Clone a generated graph document and align its saved view with the host. */
export function prepareGarphieldDocument(source, theme) {
  const document = structuredClone(source);
  if (document.config?.current?.state) {
    document.config.current.state.theme = theme;
  }
  return document;
}
