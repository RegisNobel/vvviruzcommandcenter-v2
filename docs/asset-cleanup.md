# Asset Cleanup Procedures

This document outlines the architecture for asset tracking, upload-time optimization, and cleanup of orphaned or obsolete assets (including original uploads and legacy generated exports).

---

## 1. Asset Storage & Naming Architecture

Assets are managed under two primary storage paradigms (controlled by `ASSET_STORAGE_DRIVER`):
*   **Local Storage**: Saved in `storage/` under relative kind subdirectories: `covers/`, `exclusive-art/`, `exclusive-tracks/`, etc.
*   **Vercel Blob Storage**: Uploaded to the remote Vercel Blob store under the prefix path `${BLOB_PREFIX}/${kind}/${filename}` (default prefix: `vvviruz`).

### Dynamic Display vs. Original Copies
For public-facing imagery (`cover` and `exclusive-art` assets), the upload pipeline preserves the pristine, high-fidelity asset separately from the web-optimized display copy to support high-quality distribution/archiving:
1.  **Original Copy**: Stored as `original-[UUID].[ext]` (e.g. `original-a8f9-4b67-9d7a.png`). Pristine file contents, formats, and resolutions are preserved.
2.  **Display Copy**: Stored as `[UUID].[ext]` (e.g. `a8f9-4b67-9d7a.png`). Web-optimized using `sharp` to a maximum width of 800 pixels and compressed to a quality of 80 in its native format to minimize bandwidth consumption and speed up page load times.

---

## 2. Automatic Upload-Time Replacement Cleanup

To prevent the storage from filling up with old versions of covers and exclusive art when they are replaced, the system includes an automatic replacement cleanup mechanism.

### How it Works
1.  When a user uploads a new cover art or exclusive asset, the administrative interface passes the previously used path (the database pointer) to the API endpoints as a `previousPath` parameter:
    *   `/api/releases/cover-upload`
    *   `/api/exclusive/upload`
2.  The API endpoint automatically extracts the filename from the `previousPath` and triggers `deleteAsset(kind, previousPath)`.
3.  `deleteAsset` performs a dual-wipe:
    *   Deletes the **display copy** (e.g., `uuid.png`).
    *   Deletes the **original copy** (e.g., `original-uuid.png`).
4.  This works for both **local file storage** and **Vercel Blob storage**.

---

## 3. Pruning Orphaned and Generated Assets (Manual Cleanup)

If assets become orphaned (e.g., database entries were manually deleted without trigger-based unlinking or if the application crashed during an intermediate state), you can prune them using the following procedures.

### 3.1 Cleaning Up Local Orphaned Assets
To identify and delete local files that are no longer referenced in the SQLite database, you can run a custom script. Here is an example script that you can save as `scripts/prune-orphaned-local-assets.ts` and run using `npx tsx`:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { releaseCoversDir, exclusiveArtDir, exclusiveTracksDir } from "@/lib/server/storage";

async function pruneLocal() {
  console.log("Starting local asset audit...");

  // 1. Gather all referenced asset filenames from the database
  const releases = await prisma.release.findMany({ select: { coverArtPath: true } });
  const appearsOn = await prisma.appearsOn.findMany({ select: { coverArtUrl: true } });
  const exclusiveSettings = await prisma.siteSettings.findMany(); // parse site_content for exclusive art

  const activeFilenames = new Set<string>();

  const addPath = (urlOrPath: string | null | undefined) => {
    if (!urlOrPath) return;
    const parts = urlOrPath.split("/");
    const filename = parts[parts.length - 1];
    if (filename) {
      activeFilenames.add(filename);
      // Keep the original version too
      activeFilenames.add(`original-${filename}`);
    }
  };

  releases.forEach(r => addPath(r.coverArtPath));
  appearsOn.forEach(a => addPath(a.coverArtUrl));

  // Parse site settings for exclusive art/tracks
  for (const setting of exclusiveSettings) {
    try {
      const content = JSON.parse(setting.siteContent);
      if (content?.exclusive?.exclusive_track_file_path) {
        addPath(content.exclusive.exclusive_track_file_path);
      }
      if (content?.exclusive?.exclusive_track_art_path) {
        addPath(content.exclusive.exclusive_track_art_path);
      }
    } catch {}
  }

  // 2. Scan directories and delete unreferenced files
  const directories = [
    { dir: releaseCoversDir, kind: "cover" },
    { dir: exclusiveArtDir, kind: "exclusive-art" },
    { dir: exclusiveTracksDir, kind: "exclusive-track" }
  ];

  for (const { dir, kind } of directories) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        // Skip placeholders
        if (file.startsWith(".") || file === "placeholder.txt") continue;

        if (!activeFilenames.has(file)) {
          console.log(`Pruning orphaned local ${kind} asset: ${file}`);
          await fs.unlink(path.join(dir, file));
        }
      }
    } catch (err) {
      console.warn(`Directory not found or inaccessible: ${dir}`);
    }
  }

  console.log("Local asset pruning completed successfully.");
}

pruneLocal().catch(console.error);
```

### 3.2 Cleaning Up Vercel Blob Storage
For deployments utilizing Vercel Blob storage, you can list and delete unreferenced blobs using `@vercel/blob`'s `list` and `del` functions. 

#### Identifying and Pruning Remotely
Create a file `scripts/prune-orphaned-blob-assets.ts` and run it via `npx tsx scripts/prune-orphaned-blob-assets.ts`:

```typescript
import { list, del } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";

async function pruneRemoteBlobs() {
  console.log("Fetching active database asset lists...");
  // Gather active filenames...
  // (Follow the database mapping logic as shown in the local script above)
  const activeFilenames = new Set<string>();

  // Fetch all blobs in the bucket
  const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
  let hasMore = true;
  let cursor: string | undefined;

  console.log("Scanning Vercel Blob storage...");
  while (hasMore) {
    const listResult = await list({
      prefix: `${prefix}/`,
      cursor,
      limit: 100
    });

    const toDelete: string[] = [];

    for (const blob of listResult.blobs) {
      const parts = blob.pathname.split("/");
      const filename = parts[parts.length - 1];

      // Prune if not active AND not a system file
      if (filename && !activeFilenames.has(filename)) {
        console.log(`Marking orphaned blob for deletion: ${blob.pathname} (${blob.url})`);
        toDelete.push(blob.url);
      }
    }

    if (toDelete.length > 0) {
      await del(toDelete);
      console.log(`Deleted ${toDelete.length} orphaned blobs.`);
    }

    hasMore = listResult.hasMore;
    cursor = listResult.cursor;
  }

  console.log("Vercel Blob asset pruning completed.");
}

pruneRemoteBlobs().catch(console.error);
```

---

## 4. Pruning Legacy LyricLab Exports and Generated Assets

Because the LyricLab/Video Generation feature has been permanently scrapped, any old generated video files, timeline transcripts, or exported MP4/clips can be safely pruned.

### Where Legacy Exports Were Stored
Legacy LyricLab files were stored:
*   Locally under: `storage/exports/`
*   Remotely under the Vercel Blob path: `vvviruz/export/`

### Cleanup Execution
1.  **Local storage check**:
    Check if the `storage/exports/` folder exists and delete it entirely:
    ```bash
    rm -rf storage/exports
    ```
2.  **Vercel Blob storage check**:
    You can delete all blobs starting with the prefix `vvviruz/export/` directly:
    ```typescript
    import { list, del } from "@vercel/blob";

    async function clearLegacyExports() {
      const prefix = "vvviruz/export/";
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await list({ prefix, cursor });
        const urls = result.blobs.map(b => b.url);
        if (urls.length > 0) {
          await del(urls);
          console.log(`Deleted ${urls.length} legacy video exports from Vercel Blob.`);
        }
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    }
    ```
