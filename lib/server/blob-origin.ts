import {prisma} from "@/lib/db/prisma";
import {getBlobPath} from "@/lib/server/asset-storage";

let originPromise: Promise<string | null> | null = null;
let cachedOrigin: string | null = null;

/**
 * Resolves the Vercel Blob CDN base URL origin.
 * It is resolved lazily and cached.
 */
export function getBlobOrigin(): Promise<string | null> {
  if (originPromise) {
    return originPromise;
  }

  originPromise = (async () => {
    try {
      // 1. Check feature flag first. If disabled, do not resolve or redirect.
      const redirectsEnabled = process.env.ASSET_DIRECT_BLOB_REDIRECTS === "true";
      const driverEnabled = process.env.ASSET_STORAGE_DRIVER === "vercel-blob";
      if (!redirectsEnabled || !driverEnabled) {
        return null;
      }

      // 2. Try to read from environment variable if set.
      if (process.env.BLOB_CDN_ORIGIN) {
        cachedOrigin = process.env.BLOB_CDN_ORIGIN.trim().replace(/\/+$/, "");
        return cachedOrigin;
      }

      // 3. Try to scan the database for an existing Vercel Blob URL to extract the origin.
      // Scan covers first
      const release = await prisma.release.findFirst({
        where: {
          coverArtPath: {
            startsWith: "https://"
          }
        },
        select: {
          coverArtPath: true
        }
      });

      if (release?.coverArtPath) {
        const match = release.coverArtPath.match(/^(https:\/\/[^/]+)/i);
        if (match) {
          cachedOrigin = match[1];
          return cachedOrigin;
        }
      }

      // Scan appears on entries
      const appearsOn = await prisma.appearsOn?.findFirst({
        where: {
          coverArtUrl: {
            startsWith: "https://"
          }
        },
        select: {
          coverArtUrl: true
        }
      });

      if (appearsOn?.coverArtUrl) {
        const match = appearsOn.coverArtUrl.match(/^(https:\/\/[^/]+)/i);
        if (match) {
          cachedOrigin = match[1];
          return cachedOrigin;
        }
      }

      // 4. Fallback: list one blob to extract its origin URL.
      const {list} = await import("@vercel/blob");
      const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
      const result = await list({
        limit: 1,
        prefix: `${prefix}/`
      });

      if (result.blobs.length > 0) {
        const match = result.blobs[0].url.match(/^(https:\/\/[^/]+)/i);
        if (match) {
          cachedOrigin = match[1];
          return cachedOrigin;
        }
      }
    } catch (error) {
      console.error("Failed to resolve Vercel Blob origin:", error);
    }

    return null;
  })();

  // Cache the resolved value once done
  originPromise.then((val) => {
    if (val) {
      cachedOrigin = val;
    }
  });

  return originPromise;
}

/**
 * Returns the cached Blob origin synchronously.
 */
export function getCachedBlobOrigin(): string | null {
  return cachedOrigin;
}

/**
 * Dynamically rewrites a public asset URL (e.g. /api/assets/cover/filename.jpg)
 * to a direct Vercel Blob CDN URL if the feature flag and storage driver are active.
 * Does NOT rewrite private assets.
 */
export function rewriteAssetUrlToBlob(url: string | null | undefined, blobOrigin?: string | null): string {
  if (!url) {
    return "";
  }

  const redirectsEnabled = process.env.ASSET_DIRECT_BLOB_REDIRECTS === "true";
  const driverEnabled = process.env.ASSET_STORAGE_DRIVER === "vercel-blob";

  if (!redirectsEnabled || !driverEnabled) {
    return url;
  }

  // Already a direct CDN URL
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  // Matches only public assets: cover, site-icon, exclusive-art
  const match = url.match(/\/api\/assets\/(cover|site-icon|exclusive-art)\/([^?#]+)/i);
  if (match) {
    const kind = match[1] as "cover" | "site-icon" | "exclusive-art";
    const file = match[2];

    const origin = blobOrigin || getCachedBlobOrigin();
    if (origin) {
      const blobPath = getBlobPath(kind, file);
      return `${origin}/${blobPath}`;
    }
  }

  return url;
}
