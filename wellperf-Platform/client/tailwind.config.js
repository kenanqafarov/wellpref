/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        petrol: {
          DEFAULT: "#023F46",
          50: "#EEF7F8",
          100: "#D5ECEF",
          200: "#AEDAE0",
          300: "#78BFC9",
          400: "#3E9CA9",
          500: "#177D8B",
          600: "#0A616D",
          700: "#023F46",
          800: "#033137",
          900: "#032327",
          950: "#021518",
        },
        zinc: {
          50: "rgb(var(--wp-z-50) / <alpha-value>)",
          100: "rgb(var(--wp-z-100) / <alpha-value>)",
          200: "rgb(var(--wp-z-200) / <alpha-value>)",
          300: "rgb(var(--wp-z-300) / <alpha-value>)",
          400: "rgb(var(--wp-z-400) / <alpha-value>)",
          500: "rgb(var(--wp-z-500) / <alpha-value>)",
          600: "rgb(var(--wp-z-600) / <alpha-value>)",
          700: "rgb(var(--wp-z-700) / <alpha-value>)",
          800: "rgb(var(--wp-z-800) / <alpha-value>)",
          900: "rgb(var(--wp-z-900) / <alpha-value>)",
          950: "rgb(var(--wp-z-950) / <alpha-value>)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
