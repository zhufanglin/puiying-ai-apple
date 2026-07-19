import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef7f5",
          100: "#d9ebe7",
          200: "#b9d8d1",
          300: "#8cc4b9",
          400: "#5fb0a1",
          500: "#23675f",
          600: "#1d544e",
          700: "#174f49",
          800: "#123a36",
          900: "#0e2522",
        },
      },
    },
  },
  plugins: [],
};

export default config;
