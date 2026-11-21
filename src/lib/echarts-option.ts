/**
 * Turns a blog chart's JSON ECharts option into a live one: theme colours, fonts and the few
 * placeholders JSON cannot hold (see EChartsSpec in src/lib/blog-charts.ts). Pure, so the
 * browser mount and the tests share it.
 */

export interface ResolveContext {
  /** A theme colour by token name, with an optional alpha from 0 to 1. */
  color: (name: string, alpha?: number) => string;
  /** A font stack by role: heading, body or mono. */
  font: (role: string) => string;
  /** A top-to-bottom gradient from [offset, colour] stops (colours already resolved). */
  gradient: (stops: [number, string][]) => unknown;
}

const numberFormat = new Intl.NumberFormat('en-US');

function resolveString(value: string, ctx: ResolveContext): string {
  const token = value.match(/^token:([a-z0-9]+)(?:\/([0-9.]+))?$/);
  if (token) return ctx.color(token[1] ?? '', token[2] === undefined ? undefined : Number(token[2]));
  const font = value.match(/^font:([a-z]+)$/);
  if (font) return ctx.font(font[1] ?? '');
  return value;
}

/** Resolve every placeholder in an option, returning a new value. */
export function resolveOption(value: unknown, ctx: ResolveContext): unknown {
  if (typeof value === 'string') return resolveString(value, ctx);
  if (Array.isArray(value)) return value.map((item) => resolveOption(item, ctx));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if ('__map' in record) {
    const map = record.__map as Record<string, string>;
    const fallback = typeof record.__default === 'string' ? record.__default : '';
    return (v: unknown) => map[String(v)] ?? fallback;
  }
  if (record.__number === true) return (v: unknown) => numberFormat.format(Number(v));
  if (Array.isArray(record.__gradient)) {
    const stops = (record.__gradient as [number, string][]).map(([offset, color]) => [offset, resolveString(color, ctx)] as [number, string]);
    return ctx.gradient(stops);
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) out[key] = resolveOption(item, ctx);
  return out;
}

interface TipParams {
  data?: { tip?: string } | null;
  name?: string;
  value?: unknown;
}

/** Tooltip text: the data item's `tip` when it has one, otherwise its name and value. */
export function tipFormatter(params: TipParams | TipParams[]): string {
  const first = Array.isArray(params) ? params[0] : params;
  if (!first) return '';
  if (first.data && typeof first.data === 'object' && typeof first.data.tip === 'string') return first.data.tip;
  return [first.name, Array.isArray(first.value) ? first.value.join(', ') : first.value].filter((part) => part !== undefined && part !== '').join(': ');
}

/** Scale every data item's `symbolSize` by `factor`, for charts laid out at a wider width. */
export function scaleSymbolSizes(option: Record<string, unknown>, factor: number): Record<string, unknown> {
  if (factor >= 1) return option;
  const series = (option.series as Record<string, unknown>[] | undefined)?.map((s) => ({
    ...s,
    data: (s.data as unknown[] | undefined)?.map((item) =>
      item && typeof item === 'object' && typeof (item as { symbolSize?: unknown }).symbolSize === 'number'
        ? { ...(item as object), symbolSize: Math.max(2, (item as { symbolSize: number }).symbolSize * factor) }
        : item,
    ),
  }));
  return { ...option, series };
}
