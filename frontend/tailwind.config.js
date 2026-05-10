/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#09090b",
        panel: "#111113",
        line: "#202026",
        ink: "#f4f4f5",
        muted: "#a1a1aa",
        accent: "#7dd3fc",
        success: "#34d399",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(0, 0, 0, 0.45)",
      },
      backgroundImage: {
        "portal-grid":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

