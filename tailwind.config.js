/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'seat-male': '#3b82f6',
        'seat-female': '#ec4899',
        'seat-empty': '#f3f4f6',
        'seat-restricted-male': '#1e40af',
        'seat-restricted-female': '#be185d',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}