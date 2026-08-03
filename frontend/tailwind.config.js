/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Signature palette: a deep blue-black base (not neutral gray — it
        // carries a cold undertone) with a bright ice-cyan accent. This is
        // what makes FrostByte read as "frost", not a generic dark-mode app
        // with the accent color swapped.
        ink: {
          950: "#070b12",
          900: "#0b1119",
          850: "#0f1720",
          800: "#141e2b",
          700: "#1e2c3d",
          600: "#2c4157",
          500: "#43617d",
          400: "#6684a0",
          300: "#93aec4",
          200: "#c1d5e3",
          100: "#e6f1f8"
        },
        frost: {
          600: "#0e8fa8",
          500: "#17b4d1",
          400: "#3ecbe6",
          300: "#7de0f2"
        },
        signal: {
          green: "#3ecf8e",
          amber: "#e0a83e",
          red: "#e0553f",
          blue: "#4f8ff0"
        }
      },
      fontFamily: {
        display: ["'Fjalla One'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: 0.3, transform: "scale(0.85)" },
          "50%": { opacity: 1, transform: "scale(1.15)" }
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" }
        },
        flowLine: {
          from: { strokeDashoffset: 24 },
          to: { strokeDashoffset: 0 }
        },
        frostGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(62, 203, 230, 0.0)" },
          "50%": { boxShadow: "0 0 16px 2px rgba(62, 203, 230, 0.25)" }
        }
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        slideUp: "slideUp 0.25s ease-out",
        flowLine: "flowLine 1s linear infinite",
        frostGlow: "frostGlow 2.5s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
