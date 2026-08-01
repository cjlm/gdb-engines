const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Compact counts for dense UI: 5.7k, 14.2k, 1.2m. */
export function formatCompactCount(value: number): string {
  return compactNumberFormatter
    .format(value)
    .replace(/([KMBT])$/, (suffix) => suffix.toLowerCase());
}
