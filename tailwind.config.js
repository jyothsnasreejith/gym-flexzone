/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // New Blue Dark Gym Design System
        "bg-main": "#0E3570",
        "card": "#114689",
        "card-inner": "#15569C",
        "card-hover": "#1B5FA8",
        "primary": "#15569C",
        "accent": "#F4C400",
        "accent-light": "#FFD43B",
        "success": "#22C55E",
        "text-primary": "#FFFFFF",
        "text-secondary": "#D1D5DB",
        "text-muted": "#9CA3AF",
        "border-soft": "rgba(255,255,255,0.08)",
        // Legacy colors (kept for compatibility)
        navy: "#00296B",
        "primary-blue": "#003F88",
        "secondary-blue": "#00509D",
        gold: "#FDC500",
        "gold-bright": "#FFD500",
        warning: "#FDC500",
        error: "#EF4444",
        info: "#3B82F6",
        "background-light": "#f5f7f8",
        "background-dark": "#0f1723",
      },
      backgroundColor: {
        card: "#114689",
      },
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
        display: ["Lexend", "sans-serif"],
        montserrat: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
    function({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
};
