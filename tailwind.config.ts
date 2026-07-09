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
        ink: "var(--text-primary)",
        shell: "var(--bg-app)",
        coral: "var(--brand-primary)",
        mint: "var(--brand-primary-muted)",
        sand: "var(--bg-surface-elevated)",
        dusk: "var(--bg-surface)",
        app: "var(--bg-app)",
        sidebar: "var(--bg-sidebar)",
        surface: "var(--bg-surface)",
        "surface-elevated": "var(--bg-surface-elevated)",
        "surface-hover": "var(--bg-surface-hover)",
        input: "var(--bg-input)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        inverse: "var(--text-inverse)",
        edge: "var(--border-default)",
        "edge-strong": "var(--border-strong)",
        "brand-primary": "var(--brand-primary)",
        "brand-primary-hover": "var(--brand-primary-hover)",
        "brand-primary-soft": "var(--brand-primary-soft)",
        "status-success": "var(--status-success)",
        "status-warning": "var(--status-warning)",
        "status-danger": "var(--status-danger)",
        "status-info": "var(--status-info)",
        "status-neutral": "var(--status-neutral)"
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        popover: "var(--shadow-popover)",
        modal: "var(--shadow-modal)",
        soft: "var(--shadow-panel)"
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at top left, rgba(246, 201, 69, 0.12), transparent 36%), radial-gradient(circle at top right, rgba(111, 158, 216, 0.12), transparent 32%), linear-gradient(180deg, var(--bg-surface-elevated), var(--bg-surface))"
      }
    }
  },
  plugins: []
};

export default config;
