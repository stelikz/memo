/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        memo: {
          bg: "#F6F6F4",
          surface: "#FFFFFF",
          "surface-alt": "#EEEEEA",
          ink: "#15181F",
          "ink-soft": "#454A55",
          "ink-muted": "#8A8F9A",
          line: "rgba(21,24,31,0.08)",
          "line-strong": "rgba(21,24,31,0.16)",
          accent: "#3B6FE5",
          "accent-soft": "#DCE6FB",
          success: "#3FA877",
          "success-soft": "#D5EFE0",
          warn: "#E0A33C",
          "warn-soft": "#FBEBC9",
          danger: "#D85D5D",
          "danger-soft": "#FAD9D9",
          flame: "#E0573A",
        },
      },
    },
  },
  plugins: [],
};
