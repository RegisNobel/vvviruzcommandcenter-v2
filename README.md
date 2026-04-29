# vvviruz' command center

`vvviruz' command center` is a local-first creative operating system for managing music releases, building short-form video clips, organizing promotional copy, and powering the public vvviruz artist website from the same database-backed source of truth.

It is intentionally built as a single-owner internal tool rather than a SaaS product. The app prioritizes fast iteration, clean UX, and production-minded admin security over multi-user complexity.

## Project Summary

This project combines a public-facing music website, a release tracker, a video studio, and a copywriting workspace into one Next.js app with a secure admin boundary under `/admin`.

The core idea is simple: keep the full creative workflow local, fast, and organized.

- plan and track releases
- publish a lean public artist site from structured release data
- generate video clips with live preview and export
- connect clips and copy directly to releases
- capture audience emails and gate exclusive downloads
- run everything from local storage with no cloud dependency

## Why This Project Is Interesting

- It is a full-stack internal product, not a static portfolio shell.
- It includes a real admin/auth boundary with server-enforced sessions and TOTP-based 2FA.
- It mixes product thinking, workflow design, media tooling, and local-first architecture.
- It uses Remotion, FFmpeg, and Whisper together inside a modern App Router stack.
- It is designed to support an artist workflow end to end instead of solving one isolated UI problem.

## Core Modules

### Admin Command Center

Protected admin workspace under `/admin` with a dark command-center UI and shared navigation across tools.

### Public Website

Public-facing artist hub with these routes:

- `/`
- `/music`
- `/music/[slug]`
- `/about`
- `/links`
- `/exclusives`
- `/unsubscribe`

The public site reads only published release/site-settings data from SQLite and does not expose admin-only workflow state.

### Releases

Release planning and execution workspace with:

- release metadata
- ordered stage progression
- tasks
- cover art references
- streaming links
- manual public categories/projects for music-library filtering
- linked video clips
- linked copy entries
- pinning and search

### Audience

Email capture and outreach workspace with:

- public exclusive-track landing page
- subscriber CRUD and CSV export
- exclusive offer settings
- draft, test, and full campaign sends
- per-recipient delivery logs
- unsubscribe handling

### Video Lab

Short-form video builder with:

- release-aware project setup
- audio upload and trimming
- local transcription
- lyric timing edits
- live Remotion preview
- style controls
- MP4 export
- SRT export

### Copy Lab

Hook/caption management workspace with:

- simple CRUD
- copy types
- optional release linking
- standalone neutral copy support

### Photo Lab

Placeholder route for future cover art generation workflows.

### Analytics

Placeholder route for future reporting and performance views.

## Feature Highlights

### Secure Admin Boundary

- `/admin` route namespace
- username/password login
- TOTP-based 2FA
- server-side sessions
- httpOnly cookies
- middleware and server-side protection for admin routes and private APIs

### Release Management

- release detail editing
- UPC and ISRC tracking
- collaborator tracking
- release date and concept management
- ordered stage progression with cover art as a required gate before beat completion
- computed snapshot, next action, and blockers
- generated clips section
- linked copy section

### Video Workflow

- waveform-based trim flow for clips over 30 seconds
- local Whisper transcription with English, French, Spanish, and auto-detect
- lyric line editing and retiming
- live preview updates with Remotion Player
- `9:16` and `16:9` aspect ratio support
- draggable lyric placement in preview
- solid, gradient, motion, photo, and video backgrounds
- H.264/AAC export

### Copy Workflow

- hook and caption pairing
- release-linked or standalone entries
- reusable copy type system for content ideation

### Audience and Email

- public `/exclusives` capture flow
- duplicate-safe subscriber upserts
- token-based gated download access
- Discord/community CTA settings for the exclusives page
- protected `/admin/audience` management
- consent-aware campaign sends
- unsubscribe suppression and email footers

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Remotion
- FFmpeg via `ffmpeg-static`
- FFprobe via `ffprobe-static`
- local Whisper via `@remotion/install-whisper-cpp`
- SQLite
- Prisma
- local filesystem storage for media assets

## Persistence Model

Structured app data lives behind Prisma. Local development and Docker can use SQLite, while Vercel deployment uses the Postgres schema at `prisma/schema.postgres.prisma`.

Database-backed data:

- releases
- public release metadata and slugs
- release tasks
- release streaming links
- release categories and category assignments
- site settings for the public website
- subscribers
- email campaigns
- email send logs
- video lab project metadata
- lyric lines and timing
- copy lab entries
- admin user metadata
- admin sessions

Asset-backed data:

- uploaded audio
- uploaded background photos and videos
- cover art files
- exported media
- Whisper model files
- other local binary assets under `storage/` in local mode
- Vercel Blob objects when `ASSET_STORAGE_DRIVER=vercel-blob`

Legacy JSON files under `storage/releases`, `storage/copies`, `storage/projects`, and `storage/auth` are now treated as import/back-up source material rather than the primary source of truth.

## Architecture Notes

- Local-first storage under `storage/`
- SQLite database file at `storage/vvviruz-command-center.db`
- Prisma as the relational data layer and migration system
- Thin repository layer under `lib/repositories/*`
- File system remains the home for large media assets
- Single server process
- No cloud storage
- No background worker layer
- No Stripe, auth SaaS, or multi-user system
- Public website now lives on `/`, `/music`, `/music/[slug]`, `/about`, `/links`, `/exclusives`, and `/unsubscribe`
- Private command center lives under `/admin`

## Local Development

1. Install dependencies

```bash
npm install
```

2. Install Whisper locally

```bash
npm run setup:whisper
```

3. Create local env vars in `.env.local`

```bash
DATABASE_URL=file:../storage/vvviruz-command-center.db
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=your-generated-secret
ADMIN_USERNAME=owner
ADMIN_PASSWORD_HASH=your-generated-password-hash
ADMIN_TOTP_ISSUER=vvviruz Command Center
ADMIN_SESSION_TTL_HOURS=12
ADMIN_PREAUTH_TTL_MINUTES=10
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=vvviruz <updates@example.com>
ADMIN_TEST_EMAIL=you@example.com
PUBLIC_SITE_URL=http://localhost:3000
EMAIL_POSTAL_ADDRESS=Optional mailing footer line
```

4. Generate the Prisma client and apply the tracked schema

```bash
npm run db:generate
npm run db:migrate:deploy
```

5. If you are migrating an existing local JSON workspace, import it once

```bash
npm run db:import
```

6. Start the app

```bash
npm run dev
```

7. Open:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/music](http://localhost:3000/music)
- [http://localhost:3000/exclusives](http://localhost:3000/exclusives)
- [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Docker v1

The repo includes a Dockerized `v1` setup for the secured app.

### Build and Run

1. Copy `.env.docker.example` to `.env.docker`
2. Fill in the Docker runtime env vars
3. Start the app

```bash
docker compose up --build -d
```

4. The container entrypoint applies Prisma migrations automatically on boot.

5. If you are migrating an existing local JSON workspace mounted under `storage/`, import it once:

```bash
docker compose exec app npm run db:import
```

6. If Whisper models are not installed yet:

```bash
docker compose exec app npm run setup:whisper
```

7. Open:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/music](http://localhost:3000/music)
- [http://localhost:3000/exclusives](http://localhost:3000/exclusives)
- [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Vercel Deployment Prep

The source is prepared for Vercel's Next.js build flow with `vercel.json`, `.vercelignore`, a Postgres Prisma schema, and a durable object-storage adapter.

Vercel deployment path:

1. Provision Postgres through Vercel Marketplace/Neon or another Postgres host.
2. Set `DATABASE_URL` to the Postgres connection string.
3. Provision Vercel Blob and set `ASSET_STORAGE_DRIVER=vercel-blob` plus `BLOB_READ_WRITE_TOKEN`.
4. Run `npm run db:push:postgres` once from a trusted machine or CI step to create/update the Postgres schema.
5. Deploy with the Vercel build command in `vercel.json`, which runs `npm run build:vercel` and generates Prisma from `prisma/schema.postgres.prisma`.

Required Vercel environment variables match `.env.example`:

- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `PUBLIC_SITE_URL`
- `ASSET_STORAGE_DRIVER`
- `BLOB_READ_WRITE_TOKEN`
- `BLOB_PREFIX`
- `AUTH_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_TOTP_ISSUER`
- `ADMIN_SESSION_TTL_HOURS`
- `ADMIN_PREAUTH_TTL_MINUTES`
- `EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_TEST_EMAIL`
- `EMAIL_POSTAL_ADDRESS`

Local/Docker still default to SQLite and local disk storage. Vercel should use Postgres and Vercel Blob so public-site changes, admin edits, uploads, and analytics persist across deployments.

### Production Readiness Checklist

Before deploying:

- [ ] All environment variables set in Vercel
- [ ] `DATABASE_URL` points to Postgres, not SQLite
- [ ] `ASSET_STORAGE_DRIVER` is set to `vercel-blob`
- [ ] Prisma schema pushed to the production database
- [ ] Admin credentials securely generated
- [ ] MFA enabled on all services
- [ ] Email provider configured and tested
- [ ] Public URLs verified
- [ ] Backup strategy confirmed

## Useful Commands

```bash
npm install
npm run db:generate
npm run db:migrate:dev -- --name your_change_name
npm run db:migrate:deploy
npm run db:generate:postgres
npm run db:push:postgres
npm run db:import
npm run dev
npm run build
npm run lint
npm run typecheck
npm run setup:whisper
npm run sync:releases
npm run normalize:releases
docker compose up --build -d
```

## Repo Notes

- This repository intentionally excludes local auth secrets, local media, local exports, and local storage records.
- The SQLite database file under `storage/` is intentionally excluded from source control.
- The GitHub version is source-focused and safe to review publicly.
- The app itself is designed as a private owner-operated command center, not a public SaaS product.

## Recent Updates

### 2026-04-28 22:39 -04:00

- Created and locally linked the Vercel project `vvviruzcommandcenter-v2` under the `akolly-koudouvos-projects` scope.
- Confirmed the linked Vercel project ID is `prj_2r2wj9cuTQCI2TbVwCDfynMBV18E`.
- Vercel CLI added `.vercel` to `.gitignore`; GitHub auto-linking still requires adding a Vercel Login Connection to the GitHub account.

### 2026-04-28 22:05 -04:00

- Added a production readiness checklist to the README covering Vercel environment variables, Postgres, Vercel Blob, Prisma production schema setup, admin credential security, MFA, email provider testing, public URL checks, and backups.
- Prepared the current working version for a GitHub push to `RegisNobel/vvviruzcommandcenter-v2`.

### 2026-04-28 21:48 -04:00

- Matched the public `/exclusives` exclusive-track reward section and Command Center section to the same max width for a cleaner stacked layout.
- Removed the `VVVIRUZ DETECTED` divider so the page transitions through spacing instead of a separate visual strip.

### 2026-04-28 21:06 -04:00

- Redesigned the public `/exclusives` page into a more cohesive landing experience with a lighter exclusive-track reward card, a branded `VVVIRUZ DETECTED` divider, and a wider Command Center section.
- Upgraded the Command Center benefit cards with numbered badges, visual markers, hover lift, border highlights, and subtle gold glow states.
- Added editable Public Site settings for the Command Center microcopy, CTA heading, CTA label, and helper text while preserving the existing exclusive signup/download flow.

### 2026-04-28 20:46 -04:00

- Simplified the public `/exclusives` community block by removing the body paragraph and Discord-open-note text.
- Centered the community headline, subheadline, and command-center CTA so the section reads like a tighter landing-page module.
- Removed the now-unused Community Body Copy and CTA Note controls from Public Site settings.

### 2026-04-28 17:54 -04:00

- Renamed the public exclusive-track nav destination to `/exclusives` while keeping `/exclusive` as a redirect for old links.
- Added a configurable vvviruz command center community section below the exclusive download flow, including editable Discord URL, badge, headline, CTA text, and benefit cards in Public Site settings.
- Added Prisma-backed release categories/projects so admin can group existing releases into collections like Multiversus, Switch Series, or Lover Boy EP, and public visitors can filter `/music` by those categories.
- Updated the public music search/filter flow so category membership participates in discovery without exposing admin-only release state.

### 2026-04-28 16:47 -04:00

- Added daily `/links` analytics drilldowns for `by country`, `source`, `by link`, and `utm`, matching the quick breakdown workflow from the reference screenshot.
- Moved exclusive track offer configuration out of Audience management and into Public Site management so public copy, images, links, tracking, and the exclusive offer live together.
- Added a local Windows junction from the old `lyriclab` path to `vvviruzcommandcenter` so Codex patch operations resolve correctly after the project rename.
- Right-aligned the public About page philosophy section.

### 2026-04-28 16:07 -04:00

- Added Postgres deployment support with `prisma/schema.postgres.prisma`, Postgres generate/push scripts, and a Vercel build command that generates Prisma from the Postgres schema.
- Added durable object-storage support through `ASSET_STORAGE_DRIVER=vercel-blob` and `@vercel/blob`, while preserving local disk storage for local/Docker runs.
- Added first-party `/links` analytics tracking for page views, outbound link conversions, CTR, unique visitors, platform breakdowns, referrers, and UTM/source data.
- Built the protected `/admin/analytics` dashboard and added an admin Site Settings control-map panel confirming public copy, images, links, and tracking are editable without code.

### 2026-04-24 22:25 -04:00

- Added collaborator display to public release surfaces so collabs can appear on homepage featured cards, music cards, release detail pages, links landing pages, and public music search.
- Made the admin release roadmap year-aware: `/admin/releases/roadmap` now defaults to the current year, while `?year=YYYY` can inspect another planned year without locking release dates.
- Added minimal Vercel deployment prep with `vercel.json`, `.vercelignore`, README environment notes, and a documented SQLite/local-media durability caveat for production Vercel hosting.

### 2026-04-24 21:38 -04:00

- Fixed the desktop homepage hero alignment so the left hero card and right featured-release card stack start and end on the same vertical edges again.
- Right-aligned the desktop featured-release badge to the featured column while preserving the mobile badge placement above the featured cards.
### 2026-04-24 21:27 -04:00

- Restored the desktop homepage hero badge layout so `Official Artist Hub` and the featured-release badge align across the two-column hero, while the featured badge remains directly above the cards on mobile.
- Added and applied a SQLite data-normalization migration for legacy text-based `releaseDate` values so newest-first public release sorting correctly puts Beast Mode ahead of older releases like Jeep.
- Updated public browser title templates to use the `vvviruz | Page Name` format across Home, Music, About, Links, Exclusive, release detail, and unsubscribe pages.

### 2026-04-24 21:10 -04:00

- Locked public release queries to newest-first sorting with undated releases pushed behind dated drops.
- Confirmed the homepage Latest Drops section pulls the three most recent published releases through the shared public release repository.
- Added a mobile-friendly search bar to `/music` and moved the homepage Featured Now badge directly above the featured release cards so its mobile placement is clearer.

### 2026-04-24 15:13 -04:00

- Started a mobile-first responsiveness pass across the public site and protected command center after confirming LAN access from a phone.
- Added global overflow safety rails, mobile-safe form sizing, horizontally scrollable nav rows, and wrapped panel headers to reduce narrow-screen layout collisions.
- Tuned public homepage cards, streaming buttons, About social tiles, Video Lab preview/library panels, Releases, Roadmap, Audience, and shared admin panels so phone layouts stack cleanly while desktop breakpoints remain intact.

### 2026-04-24 14:45 -04:00

- Enabled local-network testing from other devices by setting the Windows Wi-Fi profile to Private and adding an inbound firewall rule for TCP port 3000 limited to the local subnet.
- Documented local LAN testing access through the laptop LAN IP instead of localhost.
### 2026-04-24 14:33 -04:00

- Changed the Roadmap page to an at-a-glance list view inspired by the 2026 Songs reference image.
- Reframed first Wednesday as a target cadence instead of a locked schedule rule; release dates remain editable and flexible.
- Updated January from M1 to Maddive Immitastion (MI) with mixtape/EP notes and moved Beast Mode to April 8, 2026.
### 2026-04-24 14:23 -04:00

- Imported the image-provided 2026 release roadmap into the local database.
- Updated existing matching releases and created missing M1, MLTV 4, and MLTV EP records.
- Kept the first-Wednesday cadence for every 2026 month and cleared 2026 roadmap dates from releases not shown in the image.
### 2026-04-24 14:15 -04:00

- Converted the Roadmap page into a fixed 2026 monthly board with January through December slots.
- Anchored every roadmap month to the first Wednesday release cadence.
- Normalized existing dated 2026 releases in the local database to the first Wednesday of their scheduled month.
### 2026-04-24 13:51 -04:00

- Added a protected `/admin/releases/roadmap` view for scanning the next 12 unfinished releases by upcoming date.
- Reused existing release stage, blocker, progress, task, Video Lab, and Copy Lab data instead of adding a parallel planning model.
- Migrated `Release.releaseDate` from an ad hoc string to a nullable Prisma `DateTime` while keeping admin date inputs on simple `YYYY-MM-DD` values.

### 2026-04-24 02:55 -04:00

- Replaced the public About-page YouTube Connect logo with an icon-only 2017 YouTube SVG asset (`youtube-icon.svg`) so the social tile no longer displays the full wordmark.
- Added `Exclusive` as a first-class public navigation item backed by `site_settings.site_content.chrome.nav_exclusive_label`, so the exclusive capture page is reachable from the public nav.
### 2026-04-24 02:39 -04:00

- Added the public `/exclusive` landing page for exclusive-track signup, consent capture, duplicate-safe access, and token-based downloads.
- Added a protected `/admin/audience` workspace for subscriber management, CSV export, exclusive-offer configuration, campaign drafting, test sends, full sends, and delivery logs.
- Added Prisma-backed `Subscriber`, `EmailCampaign`, and `EmailSendLog` models plus the applied `audience_exclusive_email` migration.
- Added Resend-ready server-side email delivery helpers and unsubscribe flow support for compliant campaign sends.
- Added exclusive-track CTA integration on the homepage and `/links`, plus missing admin-editable fields for exclusive page metadata and CTA labels.

### 2026-04-24 01:31 -04:00

- Switched the About-page Connect section back to the official 2017 YouTube SVG wordmark (`youtube.svg`) after verifying that local asset matches the 2017 logo reference.

### 2026-04-24 01:27 -04:00

- Updated the public About-page Connect section to use the new `yt.svg` site icon asset for YouTube instead of the older logo file.

### 2026-04-24 01:11 -04:00

- Moved public site image selection into `/admin/site` so the header mark, About portrait, and Brand Pillars carousel images are all controlled from `site_settings`.
- Added a Meta Pixel foundation for the public site with admin-managed enable/id fields, while keeping tracking inactive until a real pixel ID is provided.
- Renamed the admin-facing `Lyric Lab` surface to `Video Lab`, added `/admin/video-lab`, and left `/admin/lyric-lab` as a redirect for continuity.
- Renamed the local workspace folder from `lyriclab` to `vvviruzcommandcenter` and updated the active run path accordingly.

### 2026-04-23 22:26 -04:00

- Removed unused public-site editor fields from `/admin/site`, including the legacy Hero Text, Short Bio, Long Bio, and Links Page Items inputs.
- Added a dedicated `Statement Text` field for the About page so the public artist statement is now managed directly from the current-site About settings instead of old fallback fields.
- Kept safe read-time fallback behavior so older site-settings records can still hydrate the About statement cleanly until the new field is saved.

### 2026-04-23 20:51 -04:00

- Split the About-page artist statement into separate rendered lines based on the saved line breaks.
- Removed the small `Full Bio` eyebrow text from the public About narrative section.
- Removed the Music and Identity narrative cards from the About page, leaving Intro, Philosophy, and Closing Line.
- Right-aligned the Philosophy section header treatment and centered the Closing Line section content within its card.

### 2026-04-23 20:40 -04:00

- Simplified the About-page top split-card so the left card now centers only the Artist Statement block.
- Removed the About badge, artist name, tagline, and supporting copy from the left About hero card.
- Removed the Current Focus overlay from the right portrait card so the image stands on its own.

### 2026-04-23 20:22 -04:00

- Removed the duplicate inner title from the homepage Brand Pillars carousel so each slide shows a single pillar title instead of two stacked versions.

### 2026-04-23 20:16 -04:00

- Removed the extra hero-text/identity block from the left side of the public homepage hero.
- Re-centered the remaining Official Artist Hub card content so the artist name, tagline, and CTA sit cleanly in the card without the extra text panel.

### 2026-04-23 20:02 -04:00

- Switched the public DB-driven route group to dynamic rendering so public-site content changes show up on refresh without requiring a server restart.
- Applied dynamic rendering to `/`, `/about`, `/music`, `/music/[slug]`, and the shared public layout.
- Removed static release-page generation for the public music detail route so release edits can reflect immediately.
- Confirmed the secure `/admin` area remains server-protected and separate from the public route behavior.

### 2026-04-23 19:47 -04:00

- Rebuilt the public `/links` page into a release-driven campaign landing page sourced from a selected release in `site_settings`.
- Added a Links Page release picker to `/admin/site` so the campaign page can target a specific release without code changes.
- Redesigned the public links experience around a centered cover-art card, blurred cover-art background, and stacked platform buttons.
- Added dedicated button states for Spotify, Apple Music, YouTube Music, and optional YouTube video links, showing only the links that exist on the selected release.
- Normalized external link handling so public release links can recover from missing URL schemes more gracefully.

### 2026-04-23 16:09 -04:00

- Rebuilt the public About page into a more structured artist profile with a stronger hero, a subtle visual anchor, and improved section rhythm.
- Split the biography into distinct narrative blocks: Intro, Philosophy, Music, Identity, and Closing Line.
- Added editable About-page labels and microcopy in site settings for the new narrative blocks, Connect section, and Contact section.
- Introduced the local `artist_image.png` asset from `storage/site_icons` as the About-page visual anchor.
- Updated the Contact section to use `inquiry@vvviruz.com` as the intentional fallback when no contact email or placeholder contact value is set.
- Added stronger live-data fallbacks so the hero still reads well when `short_bio` is empty.

### 2026-04-23 15:54 -04:00

- Reworked the public About page into a top-down structure: About, Full Bio, Connect, and Contact.
- Removed the public `Press / EPK` section entirely from the About page.
- Replaced the old booking/general contact split with a single general contact block.
- Added a new Connect section that renders social links as clickable icon buttons in a horizontal row.
- Simplified the public-site editor so the removed About-page sections no longer show dead configuration fields.

### 2026-04-23 15:21 -04:00

- Strengthened the public homepage hero left column with a subtle layered glow and a framed content block so the intro reads with more weight without overpowering the text.
- Reworked the hero hierarchy to flow cleanly as badge, artist name, tagline, identity stack, and CTA.
- Turned the existing hero text into a dedicated identity-stack block that supports multi-line entries and keeps the hero visually organized.
- Added a new editable `Identity Stack Label` field to public site settings so the new hero label stays site-settings-driven.

### 2026-04-23 15:10 -04:00

- Removed the extra `Listen Now` CTA from the public homepage hero so only the music exploration button remains.
- Removed the status text below the brand pillars carousel for a cleaner presentation.
- Increased the brand pillars carousel interval from 3 seconds to 5 seconds.
- Updated the carousel loop behavior so it continues moving in the same direction through the reset instead of visually reversing.

### 2026-04-23 14:54 -04:00

- Reinstated a featured area inside the homepage hero and added public-site settings support for selecting up to three featured releases.
- Added a release selector to `/admin/site` so featured homepage releases can be picked without hand-editing IDs.
- Rebuilt the brand pillars section as an auto-rotating carousel that uses the `storage/site_icons` assets in the fixed sequence: Music, Fitness, Level Up, Nerdcore, Tech.
- Replaced the text-based public header mark with the `logo.png` site icon while keeping editable alt text in site settings.
- Updated public release cards to use a full-height vertical flex layout, clamp descriptions to three lines, and pin streaming buttons to the bottom for consistent alignment.
- Extended the public asset route so `site_icons` can be served safely on the public website.

### 2026-04-23 14:24 -04:00

- Simplified the public homepage to exactly three sections: hero, brand pillars, and latest drops.
- Removed the featured-release card from the homepage so it no longer reads like a fourth section.
- Limited the homepage release strip to the three most recent public releases.
- Reworked the public footer into a single copyright line driven by `site_settings`.
- Removed the now-unused homepage featured-release copy fields and old multi-column footer copy fields from the editable public-site content model.

### 2026-04-23 14:08 -04:00

- Expanded `site_settings.site_content` so the public website now centralizes global page copy, chrome labels, footer copy, empty states, and public metadata from one editable source.
- Added a dedicated metadata/SEO section to the `/admin/site` editor for site-wide title/description plus Music, About, Links, and release-not-found metadata text.
- Switched the public layout and public page metadata to read from `site_settings` instead of hardcoded strings, while keeping release-specific content in `releases` where it belongs.
- Stabilized the default brand-pillar ids so public-site content defaults stay consistent across saves.

### 2026-04-23 22:00 -04:00

- Reworked the public About-page content model so `Intro`, `Philosophy`, and `Closing Line` each have their own dedicated site-settings text field instead of being derived from one pooled about-content source.
- Removed the old `About Content` editor field from the public-site settings UI and aligned the About-page editor with the actual three-block public layout.
- Added read-time fallbacks so existing saved site settings preserve the current About-page copy until you manually refine the new dedicated fields.

### 2026-04-23 21:55 -04:00

- Reworked the public About-page Connect section into interactive platform tiles with subtle branded accent styling, hover motion, and a centered glow treatment behind the icon group.
- Replaced the old connect sentence with an editable `connect_heading` field in `site_settings` so the section now uses a short branded headline instead of passive body copy.
- Updated the public-site admin editor and validation schema to match the new Connect-section settings shape.

### 2026-04-23 21:41 -04:00

- Audited the full public site and aligned `site_settings` with the current live UI so remaining visible static copy is now editable instead of hardcoded.
- Removed stale public-site settings that no longer map to the current design, including old home/about/link labels from earlier layouts.
- Added shared platform-label settings for public music chips and links-page CTA buttons, and wired the public pages/components to use them.
- Added a configurable public release not-found page so invalid `/music/[slug]` routes no longer fall back to framework-default copy.
- Updated the About-page contact email fallback to use the site-settings value instead of a hardcoded string.

### 2026-04-23 21:30 -04:00

- Simplified the public `/links` page by removing the extra `Latest Release` label and the `Streaming` label above the platform buttons.
- Changed the links-page badge text default to `Latest Release` and normalized older saved `Link Hub` values forward so the current site updates without manual cleanup.
- Removed the now-unused links-page label fields from the site-settings schema and admin editor.

### 2026-04-23 21:25 -04:00

- Simplified the public About-page Contact section to only show the centered microcopy and email address.
- Removed the unused `Contact`, `Direct contact`, and `General inquiries` labels from both the public render and the site-settings editor/schema surface.

### 2026-04-23 21:20 -04:00

- Moved the remaining public About-page hardcoded labels into `site_settings` so the statement heading, narrative heading, contact title, and contact email label are all admin-editable.
- Centered the About narrative heading and fully centered the Contact section layout and card content.
- Kept the About page aligned with the ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œsite settings drives public copyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â rule instead of leaving one-off hardcoded strings in the public UI.

### 2026-04-23 21:09 -04:00

- Rebuilt the public About-page Connect section around real social logo assets instead of icon buttons.
- Downloaded Instagram, TikTok, X, and YouTube SVG logos into `storage/site_icons` and served them through the existing public asset pipeline.
- Centered the Connect section layout and removed the extra Connect eyebrow so the section reads cleaner and more intentionally.

### 2026-04-23 00:39 -04:00

- Fixed public-site settings validation so blank lines inside bio/about text are allowed as expected.
- Changed link-row validation to ignore empty lines and return a clearer error only when a social/link-hub row has content but is missing either its label or URL.
- Added helper copy in the public-site admin editor to make the multiline-bio and `Label | URL` behavior clearer.

### 2026-04-23 00:09 -04:00

- Moved public website settings off the admin overview and into a dedicated `/admin/site` page with its own admin nav link.
- Improved release slug editing with auto-suggest behavior tied to the title plus a lock/custom toggle so release URLs are easier to manage safely.
- Added stricter public publish-readiness rules for releases: core public fields now gate the `is_published` toggle in the UI, and invalid public-publish saves are rejected server-side.

### 2026-04-22 23:08 -04:00

- Made the `Release planning` header block on the releases page sticky so it stays visible while scrolling through the release list.
- Matched the sticky state to the command-center theme with a darker surface, stronger border separation, and backdrop blur under the admin navbar.

### 2026-04-22 23:58 -04:00

- Built the public vvviruz website on the locked route set: `/`, `/music`, `/music/[slug]`, `/about`, and `/links`.
- Added public release fields and `site_settings` to the Prisma/SQLite schema, plus a dedicated public repository layer so UI components do not query Prisma directly.
- Kept `/admin` fully protected and separate while removing the old top-level public redirect routes that conflicted with the new route structure.
- Added a public-site section to release editing and a site-settings editor on the admin home page so public content can be managed from the current command center.
- Made published release cover art safely readable on the public site without opening other protected asset types.

### 2026-04-22 22:00 -04:00

- Enforced release stage progression in order: concept, cover art, beat made, lyrics, recorded, mix/mastered, then published.
- Updated the release snapshot so `Current Stage`, `Next Action`, and `Blockers` all follow the same ordered stage model.
- Inserted cover art into the stage flow as a required gate without adding a new checkbox field.
- Reordered the release detail sections so concept, cover art, lyrics, and stage completion now follow a clearer working order.
- Updated shared release stage labeling so the release list and release detail page stay in sync.

### 2026-04-21 16:36 -04:00

- Migrated structured app persistence from ad hoc JSON files to SQLite via Prisma.
- Added a repository layer under `lib/repositories/*` so route handlers and components can keep stable contracts while storage lives behind cleaner adapters.
- Moved releases, release tasks, release streaming links, lyric project metadata, lyric lines, copy entries, admin user metadata, and admin sessions into the database.
- Kept large media assets and generated files on disk under `storage/` and `whisper.cpp`.
- Added Prisma scripts, initial migration files, JSON-to-SQLite import tooling, and Docker migration support.
- Imported the current local JSON workspace into SQLite and verified the migration counts.

### 2026-04-21 15:26 -04:00

- Rewrote the README into a cleaner public-facing project overview.
- Tightened the positioning so the repo reads well for recruiter and portfolio review.
- Prepared the repository for public visibility.

### 2026-04-21 14:46 -04:00

- Updated WSL and verified the Dockerized `v1` app runs successfully on port `3000`.

### 2026-04-21 01:55 -04:00

- Completed the secure `/admin` lockdown with server-enforced auth, sessions, and TOTP-based 2FA.
