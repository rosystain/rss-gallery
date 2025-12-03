/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a1a',
          card: '#242424',
          hover: '#2d2d2d',
          border: '#3d3d3d',
          text: '#e5e5e5',
          'text-secondary': '#a3a3a3',
        },
      },
    },
  },
  plugins: [],
}
