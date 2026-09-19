/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ghost: {
          // Brand Palette
          burgundy: '#5B0E14',
          burgundyDark: '#3D080D',
          burgundyLight: '#741923',
          burgundySoft: '#8A3038',

          sand: '#F1E194',
          sandLight: '#F7EAB0',
          sandDark: '#D9C875',

          // Warm Surfaces & Backgrounds
          bg: '#170A0C',
          darkest: '#0F0607',
          card: '#241114',
          cardHover: '#30171A',
          border: '#4A282C',
          borderLight: '#62353A',

          // Warm Typography
          textPrimary: '#F7F2E5',
          textMuted: '#C8BDB2',
          textDim: '#938580',

          // Semantic & Mapped Fallback Accents
          cyan: '#F1E194', // Mapped to Golden Sand
          blue: '#741923',
          green: '#10B981',
          red: '#EF4444',
          amber: '#F59E0B',
          purple: '#8A3038',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
