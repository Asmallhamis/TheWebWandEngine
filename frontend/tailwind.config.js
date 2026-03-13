/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
