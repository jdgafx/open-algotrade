import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/ui/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "moon-bg": "#0D1117",
        "moon-card": "#161B22",
        "moon-green": "#00FF94",
        "moon-cyan": "#00E5FF",
        "moon-border": "#30363D",
        "moon-text": "#C9D1D9",
        "moon-text-dim": "#8B949E",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
