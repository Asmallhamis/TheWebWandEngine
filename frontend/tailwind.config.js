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
        }
      }
    },
  },
  plugins: [],
}
