/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // SmellMe "luminous boutique" palette - same tokens as the storefront.
      colors: {
        ivory: '#FBF8F3',
        pearl: '#F4EEE4',
        champagne: '#EADBC2',
        gold: '#C8A96A',
        antique: '#8A6630',
        taupe: '#5C544A',
        ink: '#1F1B16',
        line: '#E6DCCB',
        field: '#CDBFA8',
        danger: '#A33A2B',
        ok: '#3F6B3A',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Jost', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
