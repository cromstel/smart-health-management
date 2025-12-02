import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./*.{html,js}", "./build-docs.js"],
  theme: {
    extend: {
      colors: {
        'navy-blue': '#001F3F',
        'sidebar-bg': '#151515',
        'accent': '#6366f1',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    typography,
  ],
};