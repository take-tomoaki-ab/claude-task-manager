/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'status-green': '#22c55e',
        'status-yellow': '#eab308',
        'status-red': '#ef4444'
      }
    }
  },
  plugins: []
}
