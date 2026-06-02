/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-soft": "rgb(var(--color-surface-soft) / <alpha-value>)",
        "surface-strong": "rgb(var(--color-surface-strong) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        "line-strong": "rgb(var(--color-line-strong) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--color-accent-strong) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        "success-ink": "rgb(var(--color-success-ink) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        "warning-ink": "rgb(var(--color-warning-ink) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "danger-ink": "rgb(var(--color-danger-ink) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        "info-ink": "rgb(var(--color-info-ink) / <alpha-value>)",
        window: "rgb(var(--color-window) / <alpha-value>)",
        "window-active": "rgb(var(--color-window-active) / <alpha-value>)",
        "window-chrome": "rgb(var(--color-window-chrome) / <alpha-value>)",
        selection: "rgb(var(--color-selection) / <alpha-value>)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        floating: "var(--shadow-floating)",
      },
      backgroundImage: {
        "portal-grid":
          "linear-gradient(rgb(var(--grid-line) / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--grid-line) / 0.55) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
