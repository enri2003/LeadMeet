/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0055ff',
          'blue-hover': '#0044cc',
          surface: '#1d2022',
          'surface-2': '#252a2c',
          border: 'rgba(255,255,255,0.05)',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
