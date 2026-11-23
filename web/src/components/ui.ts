// Shared Tailwind class strings, kept in one place so the visual language stays
// consistent across screens.
const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:pointer-events-none disabled:opacity-50';

export const buttonPrimary =
  `${buttonBase} border-transparent bg-accent px-4 py-2 text-sm text-accent-ink shadow-sm hover:bg-accent-strong`;

export const buttonPrimarySmall =
  `${buttonBase} border-transparent bg-accent px-3 py-1.5 text-xs text-accent-ink shadow-sm hover:bg-accent-strong`;

export const buttonSecondary =
  `${buttonBase} border-line bg-surface px-4 py-2 text-sm text-ink hover:border-muted hover:bg-surface-2`;

export const buttonSecondarySmall =
  `${buttonBase} border-line bg-surface px-3 py-1.5 text-xs text-ink hover:border-muted hover:bg-surface-2`;

export const buttonGhost =
  `${buttonBase} border-transparent bg-transparent px-3 py-1.5 text-sm text-accent hover:bg-accent-soft`;

export const buttonDanger =
  `${buttonBase} border-transparent bg-transparent px-4 py-2 text-sm text-danger hover:bg-danger-soft`;

export const field = 'grid gap-1.5 text-sm font-medium';

export const hint = 'text-xs font-normal text-muted';

const fieldBase =
  'rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

export const input = `${fieldBase} w-full`;

export const textarea = `${input} min-h-24 resize-y`;

export const select = `${fieldBase} appearance-none pr-8`;

export const dateInput = `${fieldBase} w-auto`;

export const chip = 'rounded-full border px-3 py-1 text-sm transition';

export const chipOff =
  `${chip} border-line bg-surface text-muted hover:border-muted hover:text-ink`;

export const chipOn =
  `${chip} border-accent bg-accent-soft font-medium text-accent`;

export const card = 'rounded-2xl border border-line bg-surface shadow-sm';

export const mutedText = 'text-sm text-muted';

export const sectionTitle =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

const pillBase = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

export const pillOpen = `${pillBase} bg-accent-soft text-accent`;
export const pillDue = `${pillBase} bg-warn-soft text-warn`;
export const pillReviewed = `${pillBase} bg-surface-2 text-muted`;
