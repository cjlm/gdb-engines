/**
 * Draws every blog chart on the page with ECharts (SVG renderer), in the site's colours and fonts.
 *
 * Each chart is a `[data-echart]` element holding its spec's option as JSON. The option is
 * resolved against the theme (src/lib/echarts-option.ts) and redrawn when the theme changes or the
 * chart is resized.
 */
import { LineChart, ScatterChart } from 'echarts/charts';
import { GraphicComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { graphic, init, use, type ECharts } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { resolveOption, scaleSymbolSizes, tipFormatter, type ResolveContext } from './echarts-option';

use([LineChart, ScatterChart, GridComponent, TooltipComponent, TitleComponent, MarkLineComponent, MarkAreaComponent, GraphicComponent, SVGRenderer]);

interface Mounted {
  node: HTMLElement;
  chart: ECharts;
  option: Record<string, unknown>;
  scaleToWidth: number | undefined;
}

const probe = document.createElement('canvas').getContext('2d');

/** Any CSS colour as rgba(), so an alpha can be applied to it. */
function withAlpha(color: string, alpha: number): string {
  if (!probe) return color;
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  const hex = String(probe.fillStyle);
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1] ?? '0', 16)}, ${parseInt(m[2] ?? '0', 16)}, ${parseInt(m[3] ?? '0', 16)}, ${alpha})`;
}

function themeContext(node: HTMLElement): ResolveContext {
  const style = getComputedStyle(node);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const fonts: Record<string, string> = {
    heading: read('--font-heading') || 'sans-serif',
    mono: read('--font-mono') || 'monospace',
    body: style.fontFamily || 'sans-serif',
  };
  return {
    color: (name, alpha) => {
      const value = read(`--chart-${name}`);
      if (!value) throw new Error(`Blog chart uses colour "token:${name}", but --chart-${name} is not defined.`);
      return alpha === undefined ? value : withAlpha(value, alpha);
    },
    font: (role) => fonts[role] ?? fonts.body ?? 'sans-serif',
    gradient: (stops) => new graphic.LinearGradient(0, 0, 0, 1, stops.map(([offset, color]) => ({ offset, color }))),
  };
}

/** Tooltip look shared by every chart; a spec's own tooltip settings win. */
function baseTooltip(ctx: ResolveContext): Record<string, unknown> {
  return {
    confine: true,
    backgroundColor: ctx.color('bg'),
    borderColor: ctx.color('rule'),
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: ctx.color('ink'), fontFamily: ctx.font('body'), fontSize: 12, lineHeight: 17 },
    extraCssText: 'border-radius:8px;box-shadow:0 6px 20px rgb(0 0 0 / .14);max-width:300px;white-space:normal;',
  };
}

function withTips(tooltip: unknown): unknown {
  if (!tooltip || typeof tooltip !== 'object') return tooltip;
  const { useTip, ...rest } = tooltip as Record<string, unknown>;
  return useTip ? { ...rest, formatter: tipFormatter } : rest;
}

function draw(entry: Mounted): void {
  const ctx = themeContext(entry.node);
  let option = resolveOption(entry.option, ctx) as Record<string, unknown>;
  option = {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: ctx.font('body') },
    ...option,
    tooltip: { ...baseTooltip(ctx), ...(withTips(option.tooltip) as object | undefined) },
    series: (option.series as Record<string, unknown>[] | undefined)?.map((s) => (s.tooltip ? { ...s, tooltip: withTips(s.tooltip) } : s)),
  };
  if (entry.scaleToWidth) option = scaleSymbolSizes(option, entry.node.clientWidth / entry.scaleToWidth);
  entry.chart.setOption(option, true);
}

function mountAll(): void {
  const mounted: Mounted[] = [];
  for (const node of document.querySelectorAll<HTMLElement>('[data-echart]')) {
    const source = node.querySelector('script[type="application/json"]');
    if (!source?.textContent) continue;
    const option = JSON.parse(source.textContent) as Record<string, unknown>;
    const scale = Number(node.dataset.scaleToWidth);
    const entry: Mounted = { node, option, chart: init(node, undefined, { renderer: 'svg' }), scaleToWidth: scale > 0 ? scale : undefined };
    draw(entry);
    mounted.push(entry);
    let width = node.clientWidth;
    new ResizeObserver(() => {
      if (node.clientWidth === width) return;
      width = node.clientWidth;
      entry.chart.resize();
      if (entry.scaleToWidth) draw(entry);
    }).observe(node);
  }
  if (!mounted.length) return;
  const redraw = () => mounted.forEach(draw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
}

mountAll();
