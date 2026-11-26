/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      // Tons de status (FR-009). Pares fg/bg com contraste ≥ 4,5:1 (WCAG 2.1 AA).
      colors: {
        tone: {
          'warning-fg': '#7a4100',
          'warning-bg': '#fff4e0',
          'success-fg': '#1b5e20',
          'success-bg': '#e8f5e9',
          'danger-fg': '#9b1c1c',
          'danger-bg': '#fdecec',
          'neutral-fg': '#374151',
          'neutral-bg': '#f3f4f6',
          'info-fg': '#0b4f8a',
          'info-bg': '#e6f1fb',
        },
        brand: {
          DEFAULT: '#1d4ed8',
          dark: '#1e3a8a',
          light: '#dbeafe',
        },
      },
    },
  },
  plugins: [],
};
