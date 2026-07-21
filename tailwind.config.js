/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        papier: "rgb(var(--papier) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        releve: "rgb(var(--releve) / <alpha-value>)",
        encre: "rgb(var(--encre) / <alpha-value>)",
        doux: "rgb(var(--doux) / <alpha-value>)",
        trait: "rgb(var(--trait) / <alpha-value>)",
        marine: "rgb(var(--marine) / <alpha-value>)",  // bandeau, repris du logo
        vert: "rgb(var(--vert) / <alpha-value>)",      // action principale
        valide: "rgb(var(--valide) / <alpha-value>)",
        attente: "rgb(var(--attente) / <alpha-value>)",
        refus: "rgb(var(--refus) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', "system-ui", "sans-serif"],
        titre: ['"Segoe UI Variable Display"', '"Segoe UI Semibold"', '"Segoe UI"', "system-ui", "sans-serif"],
        mono: ['"Cascadia Mono"', "Consolas", "ui-monospace", "monospace"],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.05em" }],
        petit: ["0.8125rem", { lineHeight: "1.15rem" }],
        base: ["0.875rem", { lineHeight: "1.35rem" }],
        titre: ["1.0625rem", { lineHeight: "1.4rem", letterSpacing: "-0.01em" }],
        chiffre: ["1.625rem", { lineHeight: "1.8rem", letterSpacing: "-0.02em" }],
      },
      // Angles francs : outil de production, pas page vitrine.
      borderRadius: { bloc: "4px" },
      transitionDuration: { rapide: "120ms" },
    },
  },
  plugins: [],
};
