import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function filesUnder(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, {withFileTypes: true});
  const groups = await Promise.all(entries.map(async (entry): Promise<string[]> => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.name === "route.ts" ? [full] : [];
  }));
  return groups.flat();
}

async function main() {
  const routes = await filesUnder(path.join(process.cwd(), "app", "api", "analytics"));
  const privateRoutes = routes.filter((file) => !file.endsWith(path.join("track", "route.ts")));
  const adRoutes = await filesUnder(path.join(process.cwd(), "app", "api", "ads"));
  assert.ok(privateRoutes.length >= 20);
  for (const file of privateRoutes) {
    const source = await fs.readFile(file, "utf8");
    assert.match(source, /requireAuthenticatedApiRequest\(request\)/, `${file} must require a TOTP-complete admin session`);
  }
  for (const file of adRoutes) {
    const source = await fs.readFile(file, "utf8");
    assert.match(source, /requireAuthenticatedApiRequest\(request\)/, `${file} must require a TOTP-complete admin session`);
  }
  const auth = await fs.readFile(path.join(process.cwd(), "lib", "auth", "server.ts"), "utf8");
  assert.match(auth, /session\.stage !== "authenticated"/);
  const campaign = await fs.readFile(path.join(process.cwd(), "lib", "analytics", "campaign-timeline-service.ts"), "utf8");
  assert.match(campaign, /current\.campaignId !== campaignId/);
  assert.match(campaign, /release\.primaryArtistProfileId !== artist\.id/);
  const mapping = await fs.readFile(path.join(process.cwd(), "lib", "analytics", "release-mapping-service.ts"), "utf8");
  assert.match(mapping, /release\.primaryArtistProfileId !== artistProfileId/);
  const retention = await fs.readFile(path.join(process.cwd(), "lib", "analytics", "retention-data.ts"), "utf8");
  assert.match(retention, /campaign\.releaseId/);
  assert.match(retention, /selected\.artistProfileId !== artistId/);
  const imports = await fs.readFile(path.join(process.cwd(), "lib", "analytics", "spotify-import-service.ts"), "utf8");
  assert.match(imports, /const \{rawFileStorageKey,[^}]*validationSummary/);
  assert.doesNotMatch(imports, /console\.(log|warn|error)/);
  const operational = await fs.readFile(path.join(process.cwd(), "lib", "server", "operational-log.ts"), "utf8");
  assert.doesNotMatch(operational, /previewToken|rawFileStorageKey|originalValues|rowPreview/);
  const privateStorage = await fs.readFile(path.join(process.cwd(), "lib", "server", "private-object-storage.ts"), "utf8");
  assert.match(privateStorage, /PRIVATE_BLOB_READ_WRITE_TOKEN/);
  assert.match(privateStorage, /token: privateBlobToken\(\)/);
  assert.match(privateStorage, /contentType: "application\/octet-stream"/);
  assert.doesNotMatch(privateStorage, /NEXT_PUBLIC_/);
  const publicAssetRoute = await fs.readFile(path.join(process.cwd(), "app", "api", "assets", "[kind]", "[file]", "route.ts"), "utf8");
  assert.doesNotMatch(publicAssetRoute, /analytics-preview|analytics-raw|database-backups/);
  const publicText = await fs.readFile(path.join(process.cwd(), "app", "(public)", "llms.txt", "route.ts"), "utf8");
  assert.match(publicText, /Do not cite admin routes.*private preview URLs.*analytics/i);
  const allRouteText = (await Promise.all(privateRoutes.map((file) => fs.readFile(file, "utf8")))).join("\n");
  assert.match(allRouteText, /SPOTIFY_IMPORT_MAX_FILE_BYTES/);
  assert.match(allRouteText, /readLimitedAdminJson|256 \* 1024|8 \* 1024/);
  console.log("Retention route authentication, TOTP completion, IDOR guards, size limits, private-token isolation, public-route denial, payload privacy, log privacy, and public-index exclusion passed.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
