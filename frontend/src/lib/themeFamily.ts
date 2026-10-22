/**
 * Theme families.
 *
 * "Paper" themes are editorial skins inspired by Anthropic's warm, bookish
 * visual language. Unlike the glass/neon cool themes they remap the whole
 * Tailwind palette through `--tw-c-*` variables (see tailwind.config.js and
 * src/themes/paper), so components can opt into the family with a single
 * `theme-paper` class instead of per-theme branches.
 */
export const PAPER_THEMES = ['quietpaper', 'quietink'] as const;

export type PaperTheme = typeof PAPER_THEMES[number];

export const isPaperTheme = (theme: string | null | undefined): theme is PaperTheme =>
  !!theme && (PAPER_THEMES as readonly string[]).includes(theme);

/** Whether the paper family is active for the given cool UI settings. */
export const isPaperThemeActive = (settings: { coolUIMode?: boolean; coolUITheme?: string }) =>
  !!settings.coolUIMode && isPaperTheme(settings.coolUITheme);

/**
 * Picker swatches: [canvas, surface, primary, secondary].
 * Values mirror each theme's CSS variables so the settings picker can preview
 * a theme without applying it.
 */
export const THEME_SWATCHES: Record<string, readonly [string, string, string, string]> = {
  quietpaper: ['#f0eee6', '#faf9f5', '#c96442', '#141413'],
  quietink: ['#1f1e1d', '#30302e', '#d97757', '#faf9f5'],
  orionfire: ['#0c0a09', '#1c1210', '#ff4500', '#dc2626'],
  pureprism: ['#09090b', '#1e293b', '#06b6d4', '#d946ef'],
  horizondawn: ['#0f172a', '#1e293b', '#3b82f6', '#f59e0b'],
  goldenglow: ['#191400', '#2a2200', '#ffd700', '#ffb300'],
  mirrorlight: ['#141419', '#2a2a35', '#c0c0c0', '#f8f8ff'],
  gentleisland: ['#051923', '#0b2a3a', '#0ea5e9', '#38bdf8'],
  oceanreef: ['#020f14', '#062028', '#0f766e', '#0369a1'],
  whisperwind: ['#140a1e', '#22132f', '#8b5cf6', '#c084fc'],
  rainsong: ['#0a0f19', '#141c2b', '#3b82f6', '#64748b'],
  flamesong: ['#1e0000', '#330606', '#dc2626', '#ef4444'],
  stonebloom: ['#191919', '#262626', '#a8a29e', '#d4af37'],
  wolfstride: ['#051414', '#0a2424', '#0d9488', '#14b8a6'],
  blacktooth: ['#050000', '#140303', '#991b1b', '#7f1d1d'],
  toothless: ['#000000', '#0a0a0a', '#404040', '#171717'],
  titanforge: ['#0f0514', '#1d0f26', '#b45309', '#7e22ce'],
  kingfall: ['#190a0f', '#2a131a', '#ea580c', '#6b21a8'],
  goldmane: ['#191400', '#2a2200', '#facc15', '#fef08a'],
  jfdksal98a: ['#000f05', '#03200d', '#10b981', '#059669'],
};
