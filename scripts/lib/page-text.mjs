/**
 * The visible text of an HTML page, for matching quotes against it.
 *
 * Script, style and similar blocks are dropped with their contents. A self-closing tag such as
 * `<svg class="edges"/>` has no contents and no closing tag, so it is left alone: treated as an
 * opening tag it would swallow everything up to the next `</svg>` on the page, quotes included.
 */
export function pageText(html) {
  return html
    .replace(/<(script|style|noscript|svg|sup)\b[^>]*(?<!\/)>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}
