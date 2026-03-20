import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      colors: {
        bg: "#080c10",
        surface: "#0d1117",
        surface2: "#161b22",
        border: "#21262d",
        accent: "#f0a500",
        danger: "#ff4444",
        safe: "#00e676",
        warn: "#ff9800",
        muted: "#4a5568",
        "text-dim": "#718096",
      },
      keyframes: {
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        "pulse-danger": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,68,68,0.5)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255,68,68,0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        blink: "blink 0.8s ease-in-out infinite",
        "pulse-danger": "pulse-danger 1s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease",
        "fade-up": "fade-up 0.4s ease",
      },
    },
  },
  plugins: [],
};

export default config;
