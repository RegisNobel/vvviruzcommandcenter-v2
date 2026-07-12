import {prisma} from "../lib/db/prisma";

function readSlug(event: {hubPath: string; path: string}) {
  for (const value of [event.hubPath, event.path]) {
    const match = value.match(/\/listen\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return "";
}

async function main() {
  const [playlists, events] = await Promise.all([
    prisma.playlist.findMany({select: {id: true, slug: true}}),
    prisma.analyticsEvent.findMany({
      select: {hubPath: true, id: true, path: true},
      where: {
        eventType: {in: ["playlist_page_view", "playlist_track_click", "playlist_follow_click"]},
        playlistId: null
      }
    })
  ]);
  const bySlug = new Map(playlists.map((playlist) => [playlist.slug.toLowerCase(), playlist]));
  let matched = 0;
  let unmatched = 0;

  for (const event of events) {
    const slug = readSlug(event);
    const playlist = bySlug.get(slug.toLowerCase());
    if (!playlist) {
      unmatched += 1;
      continue;
    }
    await prisma.analyticsEvent.update({
      data: {playlistId: playlist.id, playlistSlug: playlist.slug},
      where: {id: event.id}
    });
    matched += 1;
  }

  console.log(JSON.stringify({matched, unmatched, ambiguous: 0, scanned: events.length}, null, 2));
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Playlist analytics backfill failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
