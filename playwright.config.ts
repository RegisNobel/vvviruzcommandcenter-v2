import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3009",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next start -p 3009",
    url: "http://localhost:3009",
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
    env: {
      DATABASE_URL: "file:c:/Users/regis/Desktop/Codex/vvviruzcommandcenter/storage/vvviruz-command-center.db",
      PORT: "3009"
    }
  },
});
