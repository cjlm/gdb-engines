import assert from 'node:assert/strict';
import test from 'node:test';

const { resolveOption, scaleSymbolSizes, tipFormatter } = await import('./echarts-option.ts');

const ctx = {
  color: (name, alpha) => (alpha === undefined ? `c(${name})` : `c(${name},${alpha})`),
  font: (role) => `f(${role})`,
  gradient: (stops) => ({ gradient: stops }),
};

test('theme tokens, fonts and gradients resolve; other strings stay', () => {
  const out = resolveOption(
    { color: 'token:accent', fill: 'token:accent/0.3', font: 'font:mono', name: 'Relate', area: { __gradient: [[0, 'token:accent/0.33'], [1, 'token:accent/0']] } },
    ctx,
  );
  assert.deepEqual(out, {
    color: 'c(accent)',
    fill: 'c(accent,0.3)',
    font: 'f(mono)',
    name: 'Relate',
    area: { gradient: [[0, 'c(accent,0.33)'], [1, 'c(accent,0)']] },
  });
});

test('map and number placeholders become formatters', () => {
  const out = resolveOption({ a: { __map: { '2017 H1': '2017' }, __default: '' }, b: { __number: true } }, ctx);
  assert.equal(out.a('2017 H1'), '2017');
  assert.equal(out.a('2017 H2'), '');
  assert.equal(out.b(12345), '12,345');
});

test('arrays and nested objects resolve throughout', () => {
  assert.deepEqual(resolveOption([{ x: ['token:ink'] }, 3, null], ctx), [{ x: ['c(ink)'] }, 3, null]);
});

test('tooltips use the data item tip, or fall back to name and value', () => {
  assert.equal(tipFormatter({ data: { tip: '<b>Hi</b>' } }), '<b>Hi</b>');
  assert.equal(tipFormatter([{ data: { tip: 'first' } }, { data: { tip: 'second' } }]), 'first');
  assert.equal(tipFormatter({ name: 'Day 2', value: [1, 2] }), 'Day 2: 1, 2');
  assert.equal(tipFormatter([]), '');
});

test('symbol sizes scale down for narrow charts, never up and never below 2', () => {
  const option = { series: [{ data: [{ value: [1, 2], symbolSize: 10 }, { value: [1, 2], symbolSize: 3 }, [1, 2]] }] };
  const scaled = scaleSymbolSizes(option, 0.5);
  assert.deepEqual(scaled.series[0].data.map((d) => d.symbolSize), [5, 2, undefined]);
  assert.equal(scaleSymbolSizes(option, 1.5), option);
});
