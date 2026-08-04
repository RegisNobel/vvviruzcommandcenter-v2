import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.GATE_C_DATABASE_URL ||
  "file:c:/Users/regis/Desktop/Codex/vvviruzcommandcenter/storage/vvviruz-command-center.db";

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
      DATABASE_URL: databaseUrl,
      DIRECT_URL: process.env.GATE_C_DIRECT_URL || databaseUrl,
      CRON_SECRET: process.env.CRON_SECRET || "stage10-playwright-cron-secret",
      AUTH_SECRET: process.env.AUTH_SECRET || "stage10-playwright-auth-secret-stage10-playwright-auth-secret",
      ADMIN_USERNAME: process.env.ADMIN_USERNAME || "stage10-admin",
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || "unused-outside-gate-c",
      ASSET_STORAGE_DRIVER: process.env.ASSET_STORAGE_DRIVER || "local",
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || "",
      PRIVATE_STORAGE_DRIVER: process.env.PRIVATE_STORAGE_DRIVER || "local",
      PRIVATE_BLOB_READ_WRITE_TOKEN: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || "",
      PRIVATE_STORAGE_PREVIEW_NAMESPACE: process.env.PRIVATE_STORAGE_PREVIEW_NAMESPACE || "analytics-preview",
      PRIVATE_STORAGE_RAW_NAMESPACE: process.env.PRIVATE_STORAGE_RAW_NAMESPACE || "analytics-raw",
      PRIVATE_STORAGE_BACKUP_NAMESPACE: process.env.PRIVATE_STORAGE_BACKUP_NAMESPACE || "database-backups",
      PORT: "3009"
    }
  },
});
