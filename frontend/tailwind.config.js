/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#F7F8FA",
        panel: "#FFFFFF",
        panelRaised: "#F1F3F7",
        hairline: "#E2E5EC",
        ink: "#171B24",
        muted: "#4B5468",
        faint: "#6C7488",
        accent: "#2F6FED",
        accentDim: "#1D4FBF",
        good: "#12805A",
        warn: "#9C6510",
        bad: "#C1352E",
      },
      fontFamily: {
        display: ["var(--font-plex-sans)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
