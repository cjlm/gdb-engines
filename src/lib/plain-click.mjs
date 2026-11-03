/** Whether a click carries a modifier that asks the browser to open the link its own way. */
export function hasModifierKey(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** Whether a click is an unmodified primary-button click the page may handle itself. */
export function isPlainPrimaryClick(event) {
  return event.button === 0 && !hasModifierKey(event);
}
