import fs from "node:fs/promises";
import path from "node:path";
import {pipeline} from "node:stream/promises";

import {
  exclusiveArtDir,
  exclusiveTracksDir,
  releaseCoversDir,
  siteIconsDir
} from "../lib/server/storage";

const kindToDir: Record<string, string> = {
  "site-icon": siteIconsDir,
  "cover": releaseCoversDir,
  "exclusive-art": exclusiveArtDir,
  "exclusive-track": exclusiveTracksDir
};

async function downloadFile(url: string, destPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  
  await fs.mkdir(path.dirname(destPath), {recursive: true});
  const fileStream = await fs.open(destPath, "w");
  const writer = fileStream.createWriteStream();
  
  // @ts-ignore - response.body is a ReadableStream in some environments, but fetch returns a Response
  await pipeline(response.body, writer);
}

async function main() {
  const manifestPath = process.argv[2] || path.join(process.cwd(), "storage", "asset-manifest.json");

  console.log(`Reading asset manifest from: ${manifestPath}`);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

  const assets = manifest.assets || [];
  console.log(`Found ${assets.length} assets in manifest.`);

  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const asset of assets) {
    // Only handle Vercel Blob assets since they have URLs
    if (asset.driver !== "vercel-blob") {
      skipped++;
      continue;
    }

    const {url, pathname} = asset;
    
    // Determine local kind and filename from pathname
    // Pathname looks like "vvviruz/covers/filename.jpg"
    const parts = pathname.split("/");
    const kindFolder = parts[parts.length - 2];
    const fileName = parts[parts.length - 1];

    let kind = "";
    if (kindFolder === "site_icons") kind = "site-icon";
    else if (kindFolder === "release-covers") kind = "cover";
    else if (kindFolder === "exclusive-art") kind = "exclusive-art";
    else if (kindFolder === "exclusive-tracks") kind = "exclusive-track";

    const targetDir = kindToDir[kind];
    if (!targetDir) {
      console.warn(`Unknown asset kind for folder "${kindFolder}": ${pathname}`);
      skipped++;
      continue;
    }

    const destPath = path.join(targetDir, fileName);

    // Check if exists
    try {
      await fs.access(destPath);
      // console.log(`Skipping existing: ${fileName}`);
      skipped++;
      continue;
    } catch {
      // Missing, download
    }

    try {
      process.stdout.write(`Downloading ${fileName}... `);
      await downloadFile(url, destPath);
      process.stdout.write("Done\n");
      downloaded++;
    } catch (err) {
      process.stdout.write(`Failed: ${err instanceof Error ? err.message : "Unknown error"}\n`);
      errors++;
    }
  }

  console.log(`\nAsset Sync Complete:`);
  console.log(`- Downloaded: ${downloaded}`);
  console.log(`- Skipped (already exist or non-blob): ${skipped}`);
  console.log(`- Errors: ${errors}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Asset sync failed.");
  process.exit(1);
});
