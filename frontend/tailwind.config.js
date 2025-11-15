/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      keyframes: {
        sweep: {
          "0%": { transform: "translateX(-100%)", opacity: 0 },
          "50%": { opacity: 1 },
          "100%": { transform: "translateX(100%)", opacity: 0 },
        },
      },
      animation: {
        sweep: "sweep 1.5s ease-in-out forwards",
      },
    },
  },


  plugins: [
    require('tailwind-scrollbar'),
  ],
}
