/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        arc: { 50:"#f0f4ff",100:"#dde7ff",200:"#c3d2ff",300:"#a0b4ff",400:"#7c90ff",500:"#6366f1",600:"#4f46e5",700:"#3730a3",800:"#2e2879",900:"#1e1b4b",950:"#0f0d2e" },
        surface: { base:"#0a0a0f", raised:"#111118", overlay:"#18181f" },
      },
      backgroundImage: {
        "arc-gradient": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in":  "fadeIn 0.2s ease-out",
        shimmer:    "shimmer 2s linear infinite",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        slideUp:  { from:{ opacity:"0", transform:"translateY(12px)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        fadeIn:   { from:{ opacity:"0" }, to:{ opacity:"1" } },
        scaleIn:  { from:{ opacity:"0", transform:"scale(0.95)" }, to:{ opacity:"1", transform:"scale(1)" } },
        shimmer:  { from:{ backgroundPosition:"-200% 0" }, to:{ backgroundPosition:"200% 0" } },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
