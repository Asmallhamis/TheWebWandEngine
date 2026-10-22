import defaultColors from 'tailwindcss/colors';

/**
 * Themeable palette.
 *
 * Every listed Tailwind color resolves through a CSS variable whose fallback is
 * the stock Tailwind value, e.g. `rgb(var(--tw-c-zinc-900, 24 24 27) / <alpha-value>)`.
 * Nothing changes unless a theme defines `--tw-c-*` variables, which lets a
 * theme (see src/themes/paper) remap the whole dark-first utility vocabulary
 * — including arbitrary opacities such as `bg-white/[0.03]` — in one place
 * instead of overriding hundreds of individual classes.
 */
const THEMEABLE_COLORS = [
  'zinc', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'red',
  'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue',
];

const hexToRgbChannels = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
  const int = parseInt(full, 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
};

const themeable = (name, hex) => `rgb(var(--tw-c-${name}, ${hexToRgbChannels(hex)}) / <alpha-value>)`;

const themeableColors = Object.fromEntries(
  THEMEABLE_COLORS.map(color => [
    color,
    Object.fromEntries(
      Object.entries(defaultColors[color]).map(([shade, hex]) => [shade, themeable(`${color}-${shade}`, hex)])
    ),
  ])
);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...themeableColors,
        white: themeable('white', '#ffffff'),
        black: themeable('black', '#000000'),
        noita: {
          bg: '#1a1a1a',
          panel: '#2a2a2a',
          accent: '#ffd700',
          mana: '#4a90e2'
        },
        cyber: {
          dark: '#050505',
          panel: '#0a0a0a',
          accent: '#c026d3',
          glow: '#d946ef',
          blue: '#3b82f6',
        }
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: .5 },
        }
      }
    },
  },
  plugins: [],
}
