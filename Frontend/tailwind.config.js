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
          darkest: '#07090e',
          bg: '#0a0d14',
          card: '#111622',
          cardHover: '#161c2d',
          border: '#1e2638',
          borderLight: '#2a354c',
          textMuted: '#74839d',
          textPrimary: '#f1f5f9',
          cyan: '#00f2fe',
          blue: '#3b82f6',
          green: '#10b981',
          red: '#f43f5e',
          amber: '#f59e0b',
          purple: '#8b5cf6',
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
