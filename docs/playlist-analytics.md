# Playlist Analytics Contract

Playlist analytics extend the shared `AnalyticsEvent`, Attribution, Ad Lab, Meta, Short Links, and backup systems. They are not a separate source of truth.

## First-party events

- `playlist_page_view`: a playlist release page was rendered.
- `playlist_track_click`: a visitor selected a configured music-platform destination.
- `playlist_follow_click`: historical compatibility only; no current public emitter.

Every new playlist event carries a reusable `eventId`. The database deduplicates on `eventId + eventType`. New events also carry stable `playlistId`, readable `playlistSlug`, `releaseId`, visitor/session identity, approved UTM fields, `fbclid`, and original external referrer when available.

## Arrival and view rules

- **Measured arrival**: a direct, external, campaign, or signed Short Link entry into the playlist experience.
- **Content view**: every playlist member page view, including internal member navigation.
- Internal “Up Next” navigation is marked `internal_navigation` and is never counted as another paid arrival.
- Legacy events without an entry type are reduced to the first view per session in Playlist Detail analytics.

## Outbound language

Outbound music clicks indicate stream intent only. They do not confirm that playback or a platform stream occurred.

Normalized platform values are `spotify`, `apple_music`, `youtube_music`, `youtube`, and `other`. The current editor supports Spotify, Apple Music, and a YouTube destination; `other` remains a legacy/reporting fallback rather than a new destination field.

## Short Links

When a Short Link points to a configured first-party `/listen/...` URL, `/p/[slug]` appends a signed, expiring `sl_ctx` token. The analytics API validates the token server-side before storing `shortLinkId`; raw client-provided database IDs are not trusted.

Short Link click totals are lifetime counters. Playlist traffic metrics use the selected reporting window, so the UI labels these bases separately.

## Meta

- Playlist arrival/content page: browser and server `ViewContent` with a shared event ID.
- Music-platform outbound click: browser and server custom `StreamingOutboundClick` with a shared event ID.
- `Lead` remains reserved for actual audience signup actions.
- Meta delivery failure does not prevent first-party storage or public navigation.

## Reporting safety

Playlist events are additive to `/links` events and remain separated by the `page` experience field. Attribution and Ad Lab use the existing release, UTM, ad-name, and latest-snapshot logic. Overlapping rolling Meta snapshots are not combined into campaign totals.

## Backups

Database snapshots include `Playlist`, `PlaylistRelease`, and playlist-aware `AnalyticsEvent` rows. Restore order is Releases, Playlists, PlaylistRelease memberships, Short Links, then Analytics Events. Historical events remain valid when new identity fields are null.
