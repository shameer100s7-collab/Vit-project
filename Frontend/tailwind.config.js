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
          bg: '#0B0F14',
          darkest: '#080C10',
          card: '#111720',
          cardHover: '#161D27',
          border: '#253041',
          borderLight: '#334155',
          textPrimary: '#F5F7FA',
          textMuted: '#9AA6B2',
          textDim: '#667085',
          cyan: '#06B6D4',
          blue: '#3B82F6',
          green: '#10B981',
          red: '#EF4444',
          amber: '#F59E0B',
          purple: '#8B5CF6',
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
