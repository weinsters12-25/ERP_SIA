import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#56AB2F",  /* Nature Primary */
          accent: "#A8E063",   /* Fresh Accent */
          dark: "#0D1F0D",     /* Dark Nature Background */
          surface: "#132B13",  /* Surface Card */
          light: "#F4FBF0",    /* Light Green Accent */
        },
      },
      backgroundImage: {
        'nature-gradient': 'linear-gradient(135deg, #56AB2F 0%, #A8E063 100%)',
      }
    },
  },
  plugins: [],
};

export default config;