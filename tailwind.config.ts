import type {Config} from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#132238",
        shell: "#0f1114",
        coral: "#c9a347",
        mint: "#8a7444",
        sand: "#2d3137",
        dusk: "#1a1d22"
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255, 255, 255, 0.03)",
        soft: "none"
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at top left, rgba(201, 163, 71, 0.12), transparent 36%), radial-gradient(circle at top right, rgba(80, 86, 94, 0.18), transparent 32%), linear-gradient(180deg, rgba(20, 23, 27, 0.98), rgba(15, 17, 20, 1))"
      }
    }
  },
  plugins: []
};

export default config;
