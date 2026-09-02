/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F1F2EE",
        ink: {
          50: "#EEF3F4",
          100: "#D7E2E4",
          400: "#3E6E7A",
          600: "#1E4C58",
          700: "#153A44",
          900: "#0B242B",
        },
        stamp: {
          // acento tipo "sello de precio" en la etiqueta de librería
          400: "#D6A02E",
          500: "#B8841E",
          600: "#95691A",
        },
        cash: "#2F8558",
        transfer: "#2B6CB0",
        card: "#6B4CB8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        ledger: "0 1px 2px rgba(11,36,43,0.06), 0 1px 0 rgba(11,36,43,0.04)",
      },
    },
  },
  plugins: [],
};
