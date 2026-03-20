/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#006B3F",
        "accent-dark": "#005632",
        page: "#F9FAFB",
        card: "#FFFFFF",
        muted: "#6B7280",
        "primary-text": "#0F172A",
        border: "#E6EEF3",
        "accent-light": "rgba(0, 107, 63, 0.1)",
      },
      boxShadow: {
        card: "0 6px 18px rgba(15,23,42,0.06)",
        md: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
