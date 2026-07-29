export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";
import {z} from "zod";

import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {parseSpotifyReleaseUrl} from "@/lib/spotify-links";

const spotifyOEmbedSchema = z.object({
  title: z.string().trim().min(1),
  thumbnail_url: z.string().url().nullable().optional()
});

export async function GET(request: Request) {
  const auth = await requireAuthenticatedApiRequest(request);
  if (auth instanceof Response) return auth;

  const rawUrl = new URL(request.url).searchParams.get("url") || "";
  let release;
  try {
    release = parseSpotifyReleaseUrl(rawUrl);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Use a valid Spotify track or album link."
      },
      {status: 400}
    );
  }

  try {
    const response = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(release.canonicalUrl)}`,
      {
        cache: "no-store",
        headers: {Accept: "application/json"},
        signal: AbortSignal.timeout(8_000)
      }
    );
    if (!response.ok) {
      return NextResponse.json(
        {message: "Spotify could not find metadata for this release."},
        {status: response.status === 404 ? 404 : 502}
      );
    }

    const parsed = spotifyOEmbedSchema.safeParse(await response.json());
    if (!parsed.success) {
      return NextResponse.json(
        {message: "Spotify returned incomplete release metadata."},
        {status: 502}
      );
    }

    return NextResponse.json({
      title: parsed.data.title,
      artworkUrl: parsed.data.thumbnail_url || "",
      spotifyUrl: release.canonicalUrl,
      resourceType: release.type,
      resourceId: release.id
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "Spotify metadata is temporarily unavailable. The link was not imported."
      },
      {status: 502}
    );
  }
}
