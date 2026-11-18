/**
 * Data colours for charts and resource dots. They label data, never actions —
 * every interactive element uses Action Blue (DESIGN.md).
 */
export const CHANNEL = {
  cpu: 'var(--color-chart-cpu)',
  gpu: 'var(--color-chart-gpu)',
  ram: 'var(--color-chart-ram)',
  disk: 'var(--color-chart-disk)'
} as const

/** Tweak categories in the dashboard donut. */
export const CATEGORY_COLORS = ['#0066cc', '#af52de', '#30b0c7', '#ff9f0a', '#34c759', '#ff375f']

