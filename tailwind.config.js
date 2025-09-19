// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        tickpop: {
          "0%": { transform: "scale(1)" },
          "20%": { transform: "scale(1.3)" },
          "40%": { transform: "scale(0.85)" },
          "60%": { transform: "scale(1.08)" },
          "80%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        tickpop: "tickpop 0.5s cubic-bezier(.6,-0.28,.74,.05)",
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
};
