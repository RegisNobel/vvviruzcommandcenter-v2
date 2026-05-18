# vvviruz' command center

`vvviruz' command center` is a local-first creative operating system for managing music releases, tracking collaborations and features, organizing promotional copy, growing an owned audience, tracking analytics, and powering the public vvviruz artist website from the same database-backed source of truth.

It is intentionally built as a single-owner internal tool rather than a SaaS product. The app prioritizes fast iteration, clean UX, and production-minded admin security over multi-user complexity.

## Project Summary

This project combines a public-facing music website, a release tracker, an audience workspace, an analytics surface, and a copywriting workspace into one Next.js app with a secure admin boundary under `/admin`.

The core idea is simple: keep the full creative workflow local, fast, and organized.

- plan and track releases
- publish a lean public artist site from structured release data
- connect copy directly to releases
- capture audience emails and gate exclusive downloads
- run everything from local storage with no cloud dependency

## Why This Project Is Interesting

- It is a full-stack internal product, not a static portfolio shell.
- It includes a real admin/auth boundary with server-enforced sessions and TOTP-based 2FA.
- It mixes product thinking, workflow design, audience capture, analytics, and local-first architecture.
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

The public site reads only published release/site-settings data and does not expose admin-only workflow state.

### Releases

Release planning and execution workspace with:

- release metadata
- ordered stage progression
- tasks
- cover art references
- streaming links
- manual public categories/projects for music-library filtering
- linked copy entries

### Appears On

Collaboration and feature tracking with:

- admin paste-and-resolve workflow from a Spotify URL via the Odesli API
- auto-filled title, artists, and cover art
- manual Apple Music, YouTube, and YouTube Music URL inputs
- publish toggle and sort order
- managed from the Public Site admin page alongside release categories
- public toggle pill on `/music` to switch between Releases and Appears On views
- pinning and search

### Audience

Email capture and outreach workspace with:

- public exclusive-track landing page with Instant Unlock or Email Only delivery modes
- private external URL support for unlisted YouTube, SoundCloud, BandLab, or Dropbox links
- transactional email delivery via Resend with compliant unsubscribe URLs
- subscriber CRUD and CSV export
- exclusive offer settings
- draft, test, and full campaign sends
- per-recipient delivery logs
- unsubscribe handling

### Copy Lab

Hook/caption management workspace with:

- simple CRUD
- hook types: Discovery Shock, Identity Callout, Proof of Skill
- creative strategy tags for Content Type, Song Section, and optional Creative Notes
- optional release linking
- standalone reusable copy support

### Photo Lab

Placeholder route for future cover art and visual asset generation workflows.

### Attribution

Performance workspace with:

- Attribution Dashboard that combines Meta CSV performance, `/links` page views, streaming outbound clicks, funnel rates, winners, risks, and next-move guidance by selected release
- `/links` page views and outbound click tracking
- country, source, link, and UTM breakdowns
- CSV-first Meta Ad Lab under `/admin/ad-lab`
- ad import batches, campaign dashboards, Copy Lab linking, and strategy breakdowns
- smart batch selection: Release-to-Date priority, non-overlapping combination, and snapshot fallback
- release-level Best/Worst Ad and Best/Worst Hook identification by CPR
- semi-automated Campaign Learning draft generation from current Ad Lab Performance data
- manual campaign learnings for release readouts

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
- linked copy section

### Appears On Management

- Spotify URL paste-and-resolve via the Odesli (Songlink) API
- auto-populated metadata: title, artists, and cover art URL
- manual override fields for Apple Music, YouTube Music, and YouTube URLs
- publish toggle and sort ordering
- centralized management under the Public Site admin page

### Copy Workflow

- hook and caption pairing
- release-linked or standalone entries
- reusable copy type system for content ideation

### Audience and Email

- public `/exclusives` capture flow with Instant Unlock and Email Only delivery modes
- private external URL support for unlisted YouTube, BandLab, SoundCloud, or Dropbox links
- configurable Instant Unlock button label and "Also send link by email" hybrid option
- transactional email delivery via `sendCampaignEmail` with dynamically generated unsubscribe URLs
- strict admin validation preventing blank email subject/body when email delivery is enabled
- duplicate-safe subscriber upserts
- token-based gated download access for uploaded track files
- Discord/community CTA settings for the exclusives page
- protected `/admin/audience` management
- consent-aware campaign sends
- unsubscribe suppression and email footers

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- SQLite for local development
- Postgres for Vercel production
- Prisma
- local filesystem storage for media assets in local mode
- Vercel Blob for durable production media assets

## Persistence Model

Structured app data lives behind Prisma. Local development can use SQLite, while Vercel deployment uses the Postgres schema at `prisma/schema.postgres.prisma`.

Database-backed data:

- releases
- public release metadata and slugs
- release tasks
- release streaming links
- release categories and category assignments
- appears-on collaboration entries
- site settings for the public website
- subscribers
- email campaigns
- email send logs
- copy lab entries
- Meta ad import batches, creative report rows, Copy Lab ad links, and campaign learnings
- admin user metadata
- admin sessions
- analytics events and backup run records

Asset-backed data:

- cover art files
- public site icons
- exclusive-track audio and art files
- other local binary assets under `storage/` in local mode
- Vercel Blob objects when `ASSET_STORAGE_DRIVER=vercel-blob`

Legacy JSON files under `storage/releases`, `storage/copies`, and `storage/auth` are now treated as import/back-up source material rather than the primary source of truth. Legacy Video Lab database tables may remain in snapshots for recovery until a future cleanup migration, but no active UI or routes depend on them.

## Architecture Notes

- Local-first storage under `storage/`
- SQLite database file at `storage/vvviruz-command-center.db`
- Prisma as the relational data layer and migration system
- Thin repository layer under `lib/repositories/*`
- File system remains the home for large media assets locally
- Vercel Blob stores media assets for production deployments
- Single server process
- No background worker layer
- No Stripe, auth SaaS, or multi-user system
- Public website now lives on `/`, `/music`, `/music/[slug]`, `/about`, `/links`, `/exclusives`, and `/unsubscribe`
- Public `/music` page supports a toggle between Releases and Appears On views
- Private command center lives under `/admin`

## Local Development

1. Install dependencies

```bash
npm install
```

2. Create local env vars in `.env.local`

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
META_CAPI_ACCESS_TOKEN=your-meta-conversions-api-token
META_DATASET_ID=your-meta-dataset-or-pixel-id
META_GRAPH_API_VERSION=v22.0
META_TEST_EVENT_CODE=optional-test-events-code
```

3. Generate the Prisma client and apply the tracked schema

```bash
npm run db:generate
npm run db:migrate:deploy
```

4. If you are migrating an existing local JSON workspace, import it once

```bash
npm run db:import
```

5. Start the app

```bash
npm run dev
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
2. Set `DATABASE_URL` to the Postgres connection string. If `DATABASE_URL` is not set, the Prisma helper script will automatically fall back to `POSTGRES_PRISMA_URL` or `POSTGRES_URL`.
3. Provision Vercel Blob and set `ASSET_STORAGE_DRIVER=vercel-blob` plus `BLOB_READ_WRITE_TOKEN`.
4. Export the current local SQLite data with `npm run db:export:snapshot`.
5. Push the Postgres schema with `DATABASE_URL` pointed at a non-pooling Postgres connection when available.
6. Import the snapshot with `npm run db:import:snapshot`.
7. Upload local media assets with `npm run assets:upload:blob`.
8. Deploy with the Vercel build command in `vercel.json`, which runs `npm run build:vercel`. This command pushes the Postgres schema with `db:push:postgres`, generates Prisma from `prisma/schema.postgres.prisma`, and then runs `next build`.

Required Vercel environment variables match `.env.example`:

- `DATABASE_URL` (auto-detected from `POSTGRES_PRISMA_URL` or `POSTGRES_URL` if not set)
- `POSTGRES_URL_NON_POOLING` or equivalent direct/non-pooling URL for trusted schema/data operations (auto-mapped to `DIRECT_URL` by the Prisma helper)
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
- `META_CAPI_ACCESS_TOKEN`
- `META_DATASET_ID` (optional when the public-site Pixel ID is already configured in Site Settings)
- `META_GRAPH_API_VERSION` (optional, defaults to `v22.0`)
- `META_TEST_EVENT_CODE` (optional, only while testing in Meta Events Manager)
- `CRON_SECRET`
- `BACKUP_ENCRYPTION_SECRET`
- `GOOGLE_DRIVE_BACKUP_ENABLED`
- `GOOGLE_DRIVE_AUTH_MODE`
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID`
- `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`
- `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_DRIVE_OAUTH_REDIRECT_URI`
- `GOOGLE_DRIVE_OAUTH_SCOPE`
- `GOOGLE_DRIVE_CLIENT_EMAIL`
- `GOOGLE_DRIVE_PRIVATE_KEY`
- `GOOGLE_DRIVE_BACKUP_FOLDER_ID`

Local development still defaults to SQLite and local disk storage. Vercel should use Postgres and Vercel Blob so public-site changes, admin edits, uploads, and analytics persist across deployments.

### Automated Backups

Production backups run through the protected `/api/cron/backups` endpoint and the daily Vercel Cron entry in `vercel.json`. The current schedule is `0 9 * * *`, which runs once per day at 09:00 UTC. During Eastern daylight time, that is 5:00 AM America/New_York.

Backup artifacts:

- Database snapshot: compressed JSON export of structured Prisma data.
- Asset manifest: compressed JSON inventory of local assets or Vercel Blob objects.
- Backup history: `BackupRun` records store status, destination, checksums, artifact size, counts, and errors.
- Backup encryption: artifacts are gzip-compressed first, then encrypted with `BACKUP_ENCRYPTION_SECRET` before leaving the server.

Primary backup destination:

- Encrypted Vercel Blob paths under `BLOB_PREFIX/backups/...`.
- The current Blob store is public-access, so backup files must remain encrypted at rest. Do not upload raw database snapshots to the public Blob store.

Optional offsite destination:

- Google Drive uploads are enabled only when `GOOGLE_DRIVE_BACKUP_ENABLED=1`.
- Preferred production mode is personal-user OAuth: set `GOOGLE_DRIVE_AUTH_MODE=oauth`, `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, and `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`.
- `GOOGLE_DRIVE_BACKUP_FOLDER_ID` can point at the personal Drive `command center` folder. If omitted, Google stores backup artifacts in the authorized account's Drive root.
- Run `npm run setup:drive-oauth` locally after creating a Google OAuth client with `http://127.0.0.1:53682/oauth2callback` as an authorized redirect URI. The helper opens a local callback server and prints the refresh token for Vercel.
- Service-account mode is still available with `GOOGLE_DRIVE_AUTH_MODE=service_account`, `GOOGLE_DRIVE_CLIENT_EMAIL`, and `GOOGLE_DRIVE_PRIVATE_KEY`, but normal My Drive uploads fail because service accounts do not have personal Drive storage quota. Use that mode only with a Google Workspace Shared Drive or delegated setup.

- Supabase/Postgres provider backups remain the first line of defense for database restore.
- App-level snapshots provide portable logical exports and an extra recovery path.
- Vercel Blob remains the primary durable media store; the asset manifest gives us a restore/audit inventory. Full binary asset mirroring to Drive should be added later only if storage size and cron duration stay manageable.

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
- [ ] Backup strategy confirmed, including `CRON_SECRET`, `BACKUP_ENCRYPTION_SECRET`, and provider backup retention

### Restoring Production Data to Local

If you need to sync your local development environment (or a new production environment) with the latest production data, you have two options:

### Option 1: One-Click Restore (UI)
The easiest way to restore data is through the **Admin Command Center**:
1. Log in to `/admin/backups`.
2. Click the **"Restore from Backup"** button.
3. Select a snapshot from the dropdown list (fetched from Google Drive).
4. Confirm the restore. The app will download, decrypt, and import the data in-memory.
   - *Note: Admin credentials are never overwritten.*

### Option 2: Manual Restore (CLI Fallback)
If you cannot access the UI or need to restore from a specific local file:

#### 1. Download Backup Artifacts
Go to your **Google Drive** backup folder and download the encrypted artifacts:
- `vcc-db-snapshot-[timestamp].json.gz.enc`
- `vcc-asset-manifest-[timestamp].json.gz.enc`

Place these files in your local `storage/` directory.

#### 2. Decrypt the Artifacts
```bash
# Decrypt Database Snapshot
npm run db:decrypt:backup -- storage/vcc-db-snapshot-[...].json.gz.enc

# Decrypt Asset Manifest
npm run db:decrypt:backup -- storage/vcc-asset-manifest-[...].json.gz.enc
```

#### 3. Import Database
```bash
npm run db:import:snapshot
```

#### 4. Sync Assets
Download missing binary files from production URLs to local storage:
```bash
npm run db:sync:assets
```

## Useful Commands

```bash
npm install
npm run db:generate
npm run db:migrate:dev -- --name your_change_name
npm run db:migrate:deploy
npm run db:generate:postgres
npm run db:push:postgres
npm run db:export:snapshot
npm run db:import:snapshot
npm run db:decrypt:backup
npm run db:sync:assets
npm run db:sync:prod
npm run db:sync:drive
npm run assets:upload:blob
npm run setup:drive-oauth
npm run db:import
npm run dev
npm run build
npm run lint
npm run typecheck
npm run sync:releases
npm run normalize:releases
```

- The SQLite database file under `storage/` is intentionally excluded from source control.
- The GitHub version is source-focused and safe to review publicly.
- The app itself is designed as a private owner-operated command center, not a public SaaS product.

## Recent Updates

### 2026-05-18 13:07 -04:00

- **Short Links V1**: Added a protected `/admin/short-links` admin tool for creating and managing branded short links.
    - Added destination URL validation, optional lowercase custom slugs, auto-generated unique slugs, copy/open/delete actions, and soft deletes.
    - Added public `/p/[slug]` redirect handling that increments click counts before redirecting and returns 404 for deleted or unknown slugs.
    - Added the `short_links` database table to SQLite/Postgres Prisma schemas, local migration, backup snapshots, and snapshot import/export flows.
 
### 2026-05-15 22:05 -04:00

- **Hybrid Sticky Toolbar for Long Pages**: Implemented a hybrid sticky pattern to improve usability on long admin pages without wasting screen space.
    - **Sticky Main Nav**: Confirmed the main admin navigation stays sticky at the top.
    - **Normal Full Headers**: Full header cards on Public Site Management and Releases pages now scroll away naturally instead of being permanently sticky.
    - **Compact Sticky Toolbars**: Added compact toolbars that appear only after scrolling past the full header cards, containing essential controls like Save, Search, Roadmap, and New Release.
    - **Synced Search**: The sticky search input on the Releases page stays in sync with the main search input.

### 2026-05-15 20:40 -04:00

- **UI Cleanup and Sticky Header**: Refined the Site Settings and Promo Lab interfaces.
    - **Sticky Site Settings Header**: Moved the "Save Site Settings" button into the "Public site management" card and made it sticky at the top for easier access while scrolling.
    - **Promo Lab Cleanup**: Removed the "Campaign Decisions" section (Campaign Intelligence and Imports / Ad Data cards) from the Promo Lab hub.

### 2026-05-15 16:30 -04:00

- **Promo Hub Rebranding & Hierarchy Optimization**: Refined the promotion workflow by simplifying the main navigation and organizing tools into a logical hierarchy.
    - **Renamed Nav to "Promo"**: Simplified the main admin navigation label to "Promo" for faster scanning, while maintaining "Promo Lab" as the internal branded page title.
    - **Logical Tool Grouping**: Reorganized the Promo Lab hub into distinct sections: **Creative Tools** (Copy & Photo Lab), **Tracking & Validation** (Attribution), and **Campaign Decisions** (Intelligence & Data).
    - **Interactive Handoffs**: Added internal anchor navigation for Campaign Intelligence and Ad Data, allowing users to jump directly to readouts or batch management from the hub.
    - **Standardized Subtitle**: Updated the hub mission statement: "Plan, test, track, and learn from every release campaign."
    - **Safe Routing & Nav Cleanup**: Fully removed legacy "Photo Lab" and "Copy Lab" top-level links, centralizing all creative ops under the unified Promo hub while preserving all existing deep-links.

### 2026-05-15 15:30 -04:00

- **Unified Commissions Infrastructure**: Streamlined the services offering by merging "Hook" and "Verse" commissions into a single unified card.
    - **Unified "Custom Hook / Verse" Card**: Replaced separate service cards with one unified $50 offering, simplifying the fan choice and reducing friction.
    - **Admin-Side Page Control**: Added a "Commissions Page Enabled" toggle and full content management for the commissions page (eyebrow, title, subtitle, card copy, and closed message) under Public Site Settings (Section 15).
    - **Dynamic Availability**: Implemented a "Commissions Closed" state that automatically renders a placeholder message when the artist is at capacity, without requiring a code change.
    - **Intelligent Navigation**: Configured the public header to show the "Commissions" navigation link only when the page is enabled in admin settings.
    - **Unified Service Type**: Updated the request submission flow to use a stable `Hook / Verse` identifier while maintaining backward compatibility for existing service records.

### 2026-05-14 21:20 -04:00

- **Vault Separation & Dedicated Teaser Page**: Decoupled "The Vault" concept from the `/exclusives` Early Access Preview flow to prepare for future paid products.
    - **Dedicated /vault Route**: Created a standalone public teaser page for "The Vault EP" featuring a future-focused direct-to-fan positioning (Off-Platform, High Quality, Digital Extras).
    - **Admin Toggle & Control**: Integrated Section 14 into the Public Site settings with a global "Vault Page Enabled" toggle and full copy/benefit card editing.
    - **Disabled State Redirect**: Configured `/vault` to automatically redirect to `/exclusives` when the page is disabled, ensuring a clean visitor experience.
    - **Clean Exclusives Flow**: Removed the Vault teaser from the `/exclusives` page to keep it strictly positioned as an "Early Access Preview" for upcoming DSP releases.
    - **Vault Analytics**: Implemented `VaultPageAnalytics` to track page views and CTA clicks specifically for the new Vault teaser.
    - **Dynamic Navigation**: Added conditional logic to the public header to show the "Vault" nav link only when enabled in admin.

### 2026-05-14 19:30 -04:00

- **Early Access Preview Repositioning**: Shifted the strategy for the public `/exclusives` page.
    - Rebranded "Exclusive Track" and "Vault" language to **Early Access Preview** and **Private Preview**.
    - Reserved "The Vault" terminology for future paid digital products.
    - Updated administrative UI labels, site-settings defaults, and API response messages to reflect the new positioning.
    - Updated subscriber source tracking contexts to align with early access previews.

### 2026-05-14 17:40 -04:00

- **Admin UI Reorganization**: Decoupled the Community Section from the Exclusive Offer settings on the Public Site settings page. 
    - **Section 9** is now dedicated to the Exclusive Track Offer (Setup, Delivery, Assets).
    - **Section 10** is now a standalone Community Section for the Command Center promo.
    - Renumbered subsequent sections (Tracking, Release Page, Social Links) to maintain a consistent numbered sequence (11-13).

### 2026-05-14 17:10 -04:00

- **The Vault Preview Strategy**: Repositioned the public `/exclusives` page as a Vault Preview capture page for the upcoming Vault EP bundle.
- **Copy & Design Overhaul**: Integrated a new "Full Vault Teaser" section highlighting off-platform tracks, WAV files, lyric booklets, and cyberpunk/glitch covers without giving away the full paid product.
- **Dynamic Configuration**: Updated the admin Site Settings defaults to support "Vault Preview List" language and modified the "Signup / Notify Me" mode to function seamlessly without requiring a hardcoded track file or private link.
- **Subscriber Attribution Tracking**: Preserved robust UTM and source tracking. Signups captured via the new Vault copy correctly attribute `sourceOfferMode`, `sourceOfferName`, and `sourceSignupContext` to the Vault list.

### 2026-05-14 17:00 -04:00

- **Final Polish & Type Safety**:
    - Resolved TypeScript import issues in the Commissions admin dashboard.
    - Hardened Next.js 15 route compatibility for all new dynamic pages.
    - Verified full production build and type-check (`tsc --noEmit`) success.
    - Synchronized `CommissionRequestRecord` type definitions with the Prisma schema.

### 2026-05-14 16:55 -04:00

- **Commission Management System**: Launched a comprehensive fan request workflow for hooks, verses, custom songs, and features.
- **Public Commissions Hub**: Created a high-fidelity `/commissions` page with service descriptions, starter pricing, and a secure request form.
- **Attribution & Metadata**: Integrated standard UTM/attribution capture into commission requests, ensuring every lead tracks its source, landing page, and referrer.
- **Protected Admin Dashboard**: Built a centralized management view at `/admin/commissions` for reviewing, quoting, and tracking the status of each request.
- **Admin Workflow Improvements**:
    - Replaced the generic "Overview" landing page with a direct redirect to the Releases dashboard.
    - Simplified the admin navigation by removing the Overview link and updating the brand logo to point to the primary workspace.
- **System Compatibility**:
    - Expanded the Database Snapshot and Restore engines to include the new `CommissionRequest` model.
    - Updated all core authentication and middleware redirects to ensure a seamless landing on the new primary dashboard.
- **Build & Prerender Stability**: Hardened several admin and public pages with `force-dynamic` markers to prevent build-time database connection errors during static generation.

### 2026-05-14 01:09 -04:00

- **One-Click Restore Engine**: Built a production-to-production restoration pipeline that allows the owner to restore the entire database from a Google Drive snapshot with one click.
- **In-Memory Decryption**: The restore process downloads, decrypts (AES-256-GCM), and decompresses (Gzip) snapshots entirely in memory to bypass Vercel's read-only filesystem constraints.
- **Smart Record Merging**: Implemented composite-key aware upserts for all tables, ensuring that relationships (like release-category assignments) are correctly updated without unique constraint violations.
- **Restore UI & Security**: Added a `BackupRestoreButton` with a backup selector dropdown and a modal confirmation. The engine explicitly skips `AdminUser` records to prevent overwriting current credentials during a restore.
- **Concurrency Guards**: Integrated checks to prevent restore operations from starting while a backup is already in progress.

### 2026-05-13 18:00 -04:00

- **Release Intelligence Layer V1.3**: Implemented a release-level rollup of campaign data.
- **Promo Verdicts**: Added a new `ReleasePromoVerdict` controlled label set (`Untested`, `Testing`, `Winner`, `Promising`, `Needs New Creative`, `Paused`, `Retired`).
- **Strict Scaling Rule**: Unified the intelligence engine to only recommend **Scaling** (Verdict: Winner / Signal: Scale Winner) if the CPR is below **$0.50**.
- **Next Move Logic**: Added dynamic "Next Move" recommendations based on the release's verdict and best hooks/creatives (e.g., "Scale carefully around [best ad]", "Keep testing. [best hook] is showing the strongest signal").
- **Release Detail Panel**: Injected a new `ReleaseIntelligencePanel` via dynamic loading (`ssr: false`) to ensure zero hydration errors while surfacing verdicts and top signals directly in the release editor.
- **Bug Fix**: Cleaned up duplicate `activeAdCount` block-scoped variable declarations in `components/ads-batch-dashboard.tsx`.

### 2026-05-13 17:50 -04:00

- **Campaign Intelligence Layer V1.2**: Major upgrade to ad-set decision making and confidence scoring.
- Replaced vague decision labels with a controlled, action-oriented set: `Scale`, `Iterate`, `Pause`, `Retire`, `Retest Hook`, `Retest Visual`, `Retest Audience`, and `Needs More Data`.
- **Micro-Budget Scaling**: Transitioned from static spend thresholds to "Per-Ad Average" logic. The system now correctly identifies winners and losers for $10/day ad sets running 5-6 creatives.
- **CBO-Aware Scoring**: Confidence scoring now scales based on "Active Ads" (spend >= $1). This prevents ads ignored by Meta's budget optimization from diluting the batch's confidence score.
- **Dynamic Recommendations**: Each decision now generates a specific, context-aware "Next Test" recommendation (e.g., "Keep visual, test sharper hook").
- **Confidence Calibration**: Spend threshold for High Confidence tuned to $30 (matching a 3-day optimization window at $10/day), with graduated warnings for "too thin" or "directional" data.
- **Archive Preparation**: Added database schema support for "Reviewed Readouts" to lock historical decisions as permanent source-of-truth.

### 2026-05-13 14:45 -04:00

- Reworked Attribution matrix statuses so Meta CSV rows without exported URL parameters show as normal `META SNAPSHOT` records instead of alarming `MISSING UTM` badges.
- Added Attribution matrix ad-name fallback matching so Meta snapshots can connect to first-party `/links` rows when the Meta export omits URL params but ad names align with `utm_content`.
- Updated Attribution guidance copy to explain Meta CSV limitations and first-party matching without implying the tracking setup is broken.

### 2026-05-13 14:31 -04:00

- Improved the Ad Lab Creative Leaderboard `Result Type` column by replacing long raw Meta conversion identifiers with compact readable badges such as `SOC`, `LPV`, `LINK`, and `CONV`.
- Preserved full Meta result details in hover tooltips while keeping the leaderboard scannable.

### 2026-05-13 14:23 -04:00

- Fixed Copy Lab variant grouping consistency by replacing exact hook/caption matching with scoped copy-idea matching inside release, hook type, and song section groups.
- Copy Lab now collapses content execution variants even when tiny typo, punctuation, or caption drift exists, while still keeping unrelated hook ideas separate.

### 2026-05-13 13:56 -04:00

- Fixed Copy Lab variant grouping so same hook/caption/release/hook-type/song-section ideas collapse consistently even when content type and hidden creative notes differ.
- Strengthened Copy Lab idea matching by normalizing punctuation, invisible characters, casing, and emoji-like separators before grouping variants.

### 2026-05-13 13:43 -04:00

- Improved Ad Lab `/links` follow-through matching for Meta exports that omit URL parameter columns by falling back from explicit CSV UTMs to normalized `Ad name` versus first-party `utm_content`.
- Updated Ad Lab attribution confidence logic so it counts explicit UTMs or matched first-party content values, avoiding misleading incomplete-UTM warnings when live Attribution data already contains matching `/links` traffic.

### 2026-05-13 13:17 -04:00

- Fixed the Ad Lab Creative Leaderboard `Result Type` column so long Meta conversion identifiers wrap inside a constrained cell instead of overlapping Link Clicks, Landing Views, and LPV columns.

### 2026-05-13 00:47 -04:00

- Fixed Attribution UTM displays so long `source`, `campaign`, and `content` strings wrap in both the Breakdown by UTM card and daily UTM detail table instead of being cut off.

### 2026-05-13 00:33 -04:00

- Enhanced Copy Lab grouping with automatic content-variant detection: duplicate copy ideas that only differ by content type now render as one variant row with clickable content-type pills.
- Kept Content Type view separated by design while collapsing variants in Release, Hook Type, Song Section, and Flat views.

### 2026-05-12 23:53 -04:00

- Improved Copy Lab library view readability with higher-contrast active grouping controls, clearer inactive pill states, and more scannable grouped-view helper text.

### 2026-05-12 23:07 -04:00

- Upgraded Ad Lab batch pages with a computed Campaign Readout that derives release, campaign, date range, spend, top/worst creative, best/worst hook, best content type, quality ratings, main lesson, next test, and decision from imported Meta data plus Copy Lab and `/links` follow-through.
- Added an Attribution Confidence Score with high, medium, and low confidence warnings so weak spend/click/view samples are treated as directional instead of decisive.
- Reframed saved campaign learning fields as optional human context instead of the primary decision layer.

### 2026-05-12 22:27 -04:00

- Added grouped Copy Lab library views so copy entries can be organized by release, hook type, content type, song section, or a flat recently-updated list.
- Made release grouping the default Copy Lab view and rendered groups as collapsible panels to reduce endless scrolling as the copy bank grows.

### 2026-05-12 20:20 -04:00

- Tightened the Attribution Dashboard status badges so first-party tracking rows render as one compact, non-wrapping pill instead of splitting into stacked half-buttons.

### 2026-05-12 20:04 -04:00

- Updated the Attribution Dashboard UTM Creative Matrix status badges so first-party-only rows now read as active first-party tracking instead of looking disabled.
- Adjusted the Campaign UTM breakdown card so long UTM strings wrap over multiple lines with the count pill aligned at the top-right of each item.

### 2026-05-12 19:53 -04:00

- Updated the public Appears On music cards so each filled platform URL renders as its own rounded button beside the track title.
- Removed the single-card primary-link behavior that made the Appears On item only open the first available platform link.

### 2026-05-12 19:41 -04:00

- Removed the standalone Roadmap link from the main admin navigation and admin overview page.
- Left the protected `/admin/releases/roadmap` route intact and kept nested roadmap pages under the Releases nav state so the roadmap remains accessible through the Releases workflow.

### 2026-05-12 19:32 -04:00

- Renamed the protected admin performance page to `/admin/attribution` and updated the admin navigation, overview cards, and internal links to use Attribution.
- Renamed the protected admin Meta CSV workspace to `/admin/ad-lab` and updated user-facing labels, import/detail links, and release detail cross-links to use Ad Lab.
- Added protected-admin route redirects so older saved admin URLs land on the new Attribution and Ad Lab routes instead of dead-ending.
- Kept Prisma models and backend API routes unchanged, including `AnalyticsEvent`, `AdImportBatch`, and `/api/analytics/track`, so the public `/links` tracking pipeline remains stable.

### 2026-05-12 16:37 -04:00

- Upgraded the existing `/admin/attribution` page into Links Attribution v2 / Attribution Dashboard instead of adding another attribution route.
- Added Meta landing page view handoff metrics, first-party tracking coverage, UTM coverage, LPV-to-stream intent, and a UTM creative matrix that compares Meta rows against `/links` views and streaming outbound clicks.
- Hardened attribution grouping so ads without UTM values stay separated by ad name instead of collapsing into one missing-UTM row.

### 2026-05-12 16:24 -04:00

- Cleaned up Ad Lab v2 labels and empty-value fallbacks that displayed mojibake arrow and dash characters.
- Replaced the LPV labels with plain `Click to LPV` wording and normalized empty metric values to `N/A` for cleaner dashboard readability.
- Kept Meta CSV parsing compatible with real em dash/en dash empty tokens by using escaped Unicode values instead of raw non-ASCII characters in code.

### 2026-05-12 13:52 -04:00

- Added Ad Lab v2 fields for the newer Meta export set: frequency, CPM, result indicator, all-click metrics, landing page views, cost per landing page view, Facebook likes, 2-second plays, cost per 3-second play, and related video cost fields.
- Upgraded the Meta CSV importer to map the delivery, engagement, performance/clicks, and video engagement export labels into the new decision metrics.
- Expanded the Ad Lab batch dashboard with landing-page handoff, cost-per-landing-view, effective frequency, CPM, 100% hold rate, result type, and a compact decision-read section.
- Updated release-level Ad Lab summaries so saved campaign learning drafts can include landing-page view quality alongside spend, clicks, results, CPR, CTR, and CPC.

### 2026-05-12 13:23 -04:00

- Reviewed the latest Meta CSV export set: delivery, engagement, performance/clicks, and video engagement.
- Confirmed the performance/clicks export now includes populated `StreamingOutboundClick` results and `Cost per results`, which the importer maps into Ad Lab campaign results/CPR.
- Hardened the Meta CSV importer for Meta's newer normalized column names: `CPC (cost per link click) (USD)` now maps to CPC, and `Cost per ThruPlay (USD)` now maps to Cost per ThruPlay.
- Updated the Ad Lab CSV smoke fixture to cover the exact newer Meta export labels so future parser changes do not regress these fields.
- Deferred deeper schema expansion for fields like frequency, CPM, landing page views, all-click metrics, and result indicator because those require a database migration and should be handled as a focused Ad Lab v2 pass.

### 2026-05-12 13:00 -04:00

- Hardened the Vercel install step after the May 2026 npm supply-chain incident by switching from `npm install` to `npm ci --ignore-scripts`.
- This keeps production installs lockfile-enforced and blocks dependency lifecycle scripts during install while leaving the explicit Prisma/Next build steps intact.

### 2026-05-10 15:52 -04:00

- Confirmed Meta Ads exports can contain genuinely blank `Results` and `Cost per results` values even when spend, reach, impressions, link clicks, and landing page views are populated.
- Hardened the Meta CSV importer so the plural `Cost per results` header maps to the internal `cost_per_result` field when future exports include a value.

### 2026-05-10 00:29 -04:00

- Simplified the admin release roadmap list view by removing the generated `title x title` monthly headline.
- Made each month's clickable release pills the primary release display while preserving monthly dates, progress, and stage status pills.

### 2026-05-09 22:39 -04:00

- Updated `/links` Meta Pixel outbound streaming tracking so both the custom `StreamingOutboundClick` event and the standard `Lead` event include `content_category: streaming_outbound_click`.
- This makes Meta custom-conversion rules based on either event name or event parameter match the same streaming-intent action.

### 2026-05-09 21:31 -04:00

- Added an Attribution Dashboard to `/admin/attribution` so a selected release can be evaluated from one view across Meta CSV spend/clicks, first-party `/links` views, and tracked streaming outbound clicks.
- Added release-level funnel cards, campaign winner cards, problem-signal watchlist, recommended next-move guidance, and a recent 14-day link-hub trend table.
- Preserved the original detailed `/links` analytics tables underneath the command dashboard for country, source, link, and UTM drill-downs.

### 2026-05-09 19:28 -04:00

- Moved the Meta Pixel base snippet into the root document `<head>` so Meta's event setup scanner can detect it on `/links`.
- Removed the duplicate public-layout body placement and kept a runtime guard so the Pixel does not execute on `/admin` routes.

### 2026-05-09 19:08 -04:00

- Added server-side Meta Conversions API forwarding from `/api/analytics/track` for `/links` `ViewContent` and streaming-platform `Lead` events.
- Added browser/server Meta `eventID` deduplication so Pixel and Conversions API events can be matched instead of double-counted.
- Limited Meta streaming conversion events to Spotify, Apple Music, YouTube Music, and YouTube video buttons while keeping first-party `/links` analytics on all tracked CTA clicks.
- Documented the Meta CAPI environment variables without committing any secret token values.

### 2026-05-09 18:48 -04:00

- Changed the public Meta Pixel base snippet from a client-only `next/script` injection to server-rendered script markup so Meta's event setup and diagnostics tools can detect the Pixel earlier on public pages.
- Kept Meta Pixel limited to the public layout while preserving the existing `ViewContent`, `StreamingOutboundClick`, and `Lead` event flow on `/links`.

### 2026-05-09 18:32 -04:00

- Added a Meta standard `Lead` event alongside the existing `StreamingOutboundClick` custom event for `/links` outbound platform taps.
- Scoped the `Lead` event parameters to `content_category: streaming_outbound_click` with release, platform, target URL, and UTM context so Meta custom conversions can use a reliable standard event while preserving the custom event signal.

### 2026-05-09 17:43 -04:00

- Updated the public `/links` analytics bridge so Meta Pixel fires the standard `ViewContent` event when the selected release link hub loads.
- Added a `StreamingOutboundClick` custom Meta Pixel event for Spotify, Apple Music, YouTube Music, YouTube video, and other tracked `/links` CTA clicks.
- Passed release id/title and UTM context into Meta Pixel event parameters so Meta Events Manager can attribute link-hub visits and outbound streaming intent more cleanly.

### 2026-05-06 09:55 -04:00

Supabase RLS Security Baseline
Overview

Supabase flagged several tables with the warning:

RLS Disabled in Public

This means the affected tables are located in the public schema, which is exposed through Supabase’s PostgREST/Data API, but Row Level Security was not enabled.

Row Level Security, or RLS, controls which rows users can access through Supabase client roles like anon and authenticated. Without RLS, public-facing roles may be able to access more data than intended depending on table grants.

Access Model

The project uses three access categories:

Category	Rule	Examples
Public website data	RLS enabled + public SELECT policy	Releases, streaming links, categories
Private/admin data	RLS enabled + no public policies	Tasks, lyrics, copy entries, ad imports
Sensitive data	RLS enabled + no public policies	Subscribers, auth sessions, admin users
Public Read Tables

These tables are safe to expose as read-only data because the public website needs them:

Release
ReleaseCategory
ReleaseCategoryAssignment
ReleaseStreamingLink
SiteSettings
AppearsOn

Each public read table should have:

alter table public."<TableName>" enable row level security;

create policy "Anyone can read <table description>"
on public."<TableName>"
for select
to anon, authenticated
using (true);

No public INSERT, UPDATE, or DELETE policies should be created for these tables.

Private/Admin Tables

These tables should have RLS enabled but should not have public policies:

LyricProject
LyricLine
ReleaseTask
AdminUser
EmailCampaign
EmailSendLog
Subscriber
AnalyticsEvent
AuthSession
PublicRateLimit
BackupRun
CopyEntry
AdImportBatch
AdCampaignLearning
AdCreativeReport
AdCreativeCopyLink

These tables should only be accessed through protected server-side admin routes using the Supabase service role key.

The service role key must never be exposed in frontend/browser code.

Baseline SQL
-- Public read tables
alter table public."Release" enable row level security;
alter table public."ReleaseCategory" enable row level security;
alter table public."ReleaseCategoryAssignment" enable row level security;
alter table public."ReleaseStreamingLink" enable row level security;
alter table public."SiteSettings" enable row level security;
alter table public."AppearsOn" enable row level security;

create policy "Anyone can read releases"
on public."Release"
for select
to anon, authenticated
using (true);

create policy "Anyone can read release categories"
on public."ReleaseCategory"
for select
to anon, authenticated
using (true);

create policy "Anyone can read release category assignments"
on public."ReleaseCategoryAssignment"
for select
to anon, authenticated
using (true);

create policy "Anyone can read release streaming links"
on public."ReleaseStreamingLink"
for select
to anon, authenticated
using (true);

create policy "Anyone can read site settings"
on public."SiteSettings"
for select
to anon, authenticated
using (true);

create policy "Anyone can read appears on releases"
on public."AppearsOn"
for select
to anon, authenticated
using (true);

-- Private/admin/sensitive tables
alter table public."LyricProject" enable row level security;
alter table public."LyricLine" enable row level security;
alter table public."ReleaseTask" enable row level security;
alter table public."AdminUser" enable row level security;
alter table public."EmailCampaign" enable row level security;
alter table public."EmailSendLog" enable row level security;
alter table public."Subscriber" enable row level security;
alter table public."AnalyticsEvent" enable row level security;
alter table public."AuthSession" enable row level security;
alter table public."PublicRateLimit" enable row level security;
alter table public."BackupRun" enable row level security;
alter table public."CopyEntry" enable row level security;
alter table public."AdImportBatch" enable row level security;
alter table public."AdCampaignLearning" enable row level security;
alter table public."AdCreativeReport" enable row level security;
alter table public."AdCreativeCopyLink" enable row level security;
Validation Checklist

After applying RLS changes:

[ ] Supabase Security Advisor no longer reports "RLS Disabled in Public" for these tables
[ ] Public pages still load releases, categories, site settings, streaming links, and Appears On data
[ ] Anonymous users cannot insert, update, or delete public website data
[ ] Anonymous users cannot read admin/private tables
[ ] Subscriber emails are not readable from the public client
[ ] Admin dashboard still works through protected server-side routes
[ ] Supabase service role key is only used server-side

### 2026-05-14 02:11 -04:00

- Added a "Signup / Notify Me" capture mode to the public `/exclusives` flow.
- The new mode allows the signup form to appear without requiring a finalized lead magnet (no uploaded file or private external URL).
- Refined the signup success experience for Notify mode: it now displays "Your exclusive track is on its way." instead of the download-specific message.
- Added Subscriber Source Tracking to capture `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, and `landingPage` upon signup.
- Updated the Admin Command Center Audience list to display the acquisition campaign and offer context.

### 2026-05-06 02:07 -04:00

- Added a visually hidden `bot_test_field` honeypot to the public exclusives capture form.
- Updated `/api/exclusive/claim` to silently return a fake success response when the honeypot is filled, without creating a subscriber, sending email, or consuming rate-limit buckets.
- Added UTM/click-id passthrough on `/links` outbound streaming buttons so `utm_*`, `fbclid`, `gclid`, and `msclkid` values remain attached when visitors leave for Spotify, Apple Music, YouTube Music, or YouTube.

### 2026-05-01 17:48 -04:00

- Prepared a public-site performance patch for the image-heavy pages.
- Removed `unoptimized` from public `next/image` usage so Next can generate optimized image variants.
- Added Vercel Blob host allowlisting, AVIF/WebP output formats, and a one-day minimum optimized-image cache TTL in `next.config.mjs`.
- Added cache-control headers, `ETag`, `Last-Modified`, and `304 Not Modified` support to public asset responses while keeping private assets on `private, no-store`.
- Verified the asset cache path locally with a `200` first request and `304` repeat request using `If-None-Match`.

### 2026-05-01 16:50 -04:00

- Updated release-level Ad Lab summaries to correctly handle summarized Meta CSV exports without double-counting overlapping batches.
- Added smart batch selection logic: prefers Release-to-Date or Full Campaign exports, combines non-overlapping fixed-period batches, and falls back to the most recent snapshot when ranges overlap.
- Added Best Ad, Worst Ad, Best Hook, and Worst Hook identification to the release-level Ad Lab Performance summary using CPR-based ranking with minimum spend and result thresholds.
- Added a "Generate Draft Learning" button to the Campaign Learning section that pre-fills Campaign Summary, What Worked, What Failed, Next Test, and Decision fields from the current Ad Lab Performance snapshot.
- Draft learnings include source label, reporting date range, attribution setting, and key metrics; they do not autosave and require manual review.
- Added an Instant Unlock experience to the public `/exclusives` capture flow so visitors can access an external private link immediately after submitting their name and email.
- Added admin Unlock Experience controls with two modes: Instant Unlock (default) and Email Only, plus an "Also send link by email" checkbox for hybrid delivery.
- Added admin fields for Private External URL, Instant Unlock Button Label, Email Subject, and Email Body to the Exclusive Track Offer settings panel.
- Added strict validation that prevents saving site settings when email delivery is enabled but the email subject or body is blank.
- Updated the public exclusive offer availability logic to accept a Private External URL as a valid unlock mechanism alongside uploaded track files.
- Updated the `/api/exclusive/claim` endpoint to support transactional email delivery via `sendCampaignEmail` with dynamically generated unsubscribe URLs for Resend compliance.
- Updated the public exclusive signup form to conditionally render an external link CTA button, a legacy file download button, or a check-your-inbox message depending on the configured unlock experience.
- Centered the exclusive track title and badge text in the public `/exclusives` preview card.

### 2026-05-01 10:00 -04:00

- Added the Appears On feature for managing music collaborations and features.
- Added the `AppearsOn` Prisma model to both SQLite and Postgres schemas with title, artists, cover art URL, streaming links, publish toggle, and sort order.
- Added an Odesli (Songlink) API integration under `lib/server/odesli.ts` that auto-resolves metadata and cover art from a pasted Spotify URL.
- Added admin create/edit pages under `/admin/appears-on` with a paste-and-resolve workflow for Spotify URLs and manual input fields for Apple Music, YouTube Music, and YouTube links.
- Integrated Appears On management into the Public Site admin page (`/admin/site`) alongside release categories, rather than as a standalone admin navigation item.
- Added a Releases/Appears On toggle pill on the public `/music` page so visitors can switch between original releases and collaboration entries.
- Added the `PublicAppearsOnLibrary` component for rendering published collaboration cards with cover art, artists, and streaming-platform links.
- Fixed public site footer positioning by converting the page shell to a flex column layout with `flex-grow` on the main content area so the footer always sits at the bottom of the viewport.
- Updated `scripts/run-prisma.mjs` to automatically detect Vercel-provided Postgres environment variables (`POSTGRES_PRISMA_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`) when `DATABASE_URL` or `DIRECT_URL` are not explicitly set.
- Added `directUrl` to `prisma/schema.postgres.prisma` so `db:push` bypasses connection pooling during schema migrations on Vercel.
- Updated `build:vercel` to run `db:push:postgres` before `db:generate:postgres` and `next build` so new schema changes are applied to production Postgres automatically during deployment.
- Removed accidentally committed `test.js` scratch file and added it to `.gitignore`.

### 2026-04-30 20:27 -04:00

- Added snapshot-aware Ad Lab batch metadata: `exportedAt`, `attributionSetting`, and `batchType`.
- Defaulted new Meta imports to `Rolling Snapshot` with the current attribution setting of `7-day click, 1-day view, 1-day engagement`.
- Updated `/admin/ad-lab/import`, `/admin/ad-lab`, and `/admin/ad-lab/[batchId]` to display batch type, export time, attribution setting, and reporting window.
- Added rolling-snapshot helper copy warning that overlapping Meta snapshots should not be summed together.
- Added comparison helper logic that labels overlapping ranges as Snapshot Comparison and only permits combined totals for non-overlapping Fixed Period batches.

### 2026-04-30 19:54 -04:00

- Added safe Ad Lab batch deletion from both `/admin/ad-lab` import history and `/admin/ad-lab/[batchId]`.
- Batch deletion requires typing `DELETE` and removes only the selected import batch, its creative rows, row-level Copy Lab links, and campaign learnings.
- Added a route-specific not-found state for deleted/missing ad batches.
- Added Copy Lab link carryover so new imports for the same release auto-link matching normalized ad names from the most recent previous batch.

### 2026-04-30 19:38 -04:00

- Fixed Ad Lab Meta CSV merge logic so imported metric-view files merge by normalized `adName + reportingStart + reportingEnd`, no longer by `adSetName`.
- Treats `adSetName` as an enrichment field, keeping the first non-empty value and logging conflicts instead of creating duplicate ad rows.
- Added source-aware, non-additive merge behavior so delivery, engagement, and video CSV views fill their trusted metric groups without doubling spend, impressions, reach, results, clicks, or video metrics.
- Added `npm run smoke:ads-merge` as a regression check for the scenario where only one uploaded Meta CSV contains `Ad set name`.

### 2026-04-30 19:05 -04:00

- Added Ad Lab v1 under `/admin/ad-lab` with CSV-first Meta report imports, import history, release filtering, and batch dashboards.
- Added normalized Prisma tables for ad import batches, creative report rows, ad-to-Copy-Lab links, and campaign learnings.
- Added Meta CSV parsing for common report columns, safe number/date parsing, multi-file row merging, and graceful missing-column handling.
- Added creative leaderboards, rule-based performance signals, strategy breakdowns by Hook Type, Content Type, Song Section, and combo, plus optional `/links` UTM follow-through matching.
- Added campaign learning save/reload support and surfaced the latest release-specific ad learning on release detail pages.
- Updated backups and DB snapshot scripts so Ad Lab data is included in exports/imports.

### 2026-04-30 15:01 -04:00

- Expanded Copy Lab for future Ad Lab tagging with `hookType`, `contentType`, `songSection`, and `creativeNotes` fields in Prisma.
- Kept the legacy Copy Lab `type` column as a compatibility fallback while moving the app UI to the clearer Hook Type label.
- Added Creative Strategy controls to Copy Lab create/edit flows and a Strategy Summary sidebar on copy detail pages.
- Updated Copy Lab list and release-linked copy cards to show Hook Type plus lightweight strategy tags.
- Added and applied the local SQLite migration `20260430143000_copy_strategy_fields`.

### 2026-04-30 14:08 -04:00

- Updated Copy Lab hook types to the focused set: Discovery Shock, Identity Callout, and Proof of Skill.
- Mapped legacy saved copy type values into the new hook-type set so older copy entries continue to load and edit safely.
- Updated Copy Lab creation language from copy angle/neutral copy to hook type/reusable standalone copy.

### 2026-04-30 13:24 -04:00

- Added tag-based server-side caching for public site settings, published releases, release categories, release-detail lookups, related releases, link-page release selection, and exclusive offer reads.
- Added explicit public cache invalidation when admin saves site settings, exclusive offer settings, releases, release pin/status edits, release deletes, or music categories.
- Kept public pages dynamic so admin changes still appear after cache invalidation instead of requiring a server restart.
- Verified warm dev-server route times dropped to roughly `70-200ms` in Next logs after initial dev compilation.

### 2026-04-30 08:30 -04:00

- Removed the admin Video Lab feature surface, including the nav link, admin dashboard card, `/admin/video-lab` route, and legacy `/admin/lyric-lab` redirect.
- Removed Video Lab upload, trim, transcription, project, background, and export API handlers plus Remotion, FFmpeg, Whisper, waveform, and video-rendering runtime code.
- Removed the release-detail Generated Clips section so release pages now show active release planning and Copy Lab linking only.
- Pruned Video Lab dependencies and setup commands from package metadata, Tailwind scanning, and active README setup docs while leaving legacy Prisma tables intact for a future reversible cleanup migration.

### 2026-04-30 02:09 -04:00

- Enabled Google Drive offsite backups in production through personal-user OAuth so encrypted backup artifacts upload against the owner's Drive quota instead of service-account storage.
- Stored the OAuth backup env vars in Vercel as sensitive production values and kept the local OAuth callback output out of source control.
- Verified the protected production backup route uploads both database snapshots and asset manifests to Vercel Blob and Google Drive.
- Documented the active daily backup schedule as 09:00 UTC, currently 5:00 AM America/New_York during daylight saving time.

### 2026-04-30 01:23 -04:00

- Switched the Google Drive backup adapter to support personal-user OAuth refresh-token auth so offsite backups can upload against the owner's Drive quota.
- Kept the existing service-account path as an explicit `GOOGLE_DRIVE_AUTH_MODE=service_account` fallback for future Shared Drive or delegated setups.
- Added `npm run setup:drive-oauth` to generate a Google authorization URL, capture the local callback, and exchange the code for a refresh token.
- Updated `.env.example` and README backup documentation with the OAuth env vars and setup flow.

### 2026-04-30 00:18 -04:00

- Located the Google Drive `command center` folder created for offsite backups and stored its folder ID in Vercel as `GOOGLE_DRIVE_BACKUP_FOLDER_ID`.
- Confirmed `CRON_SECRET`, `BACKUP_ENCRYPTION_SECRET`, `GOOGLE_DRIVE_BACKUP_ENABLED`, and `GOOGLE_DRIVE_BACKUP_FOLDER_ID` are present as sensitive production Vercel env vars.
- Kept Google Drive offsite uploads disabled until `GOOGLE_DRIVE_CLIENT_EMAIL` and `GOOGLE_DRIVE_PRIVATE_KEY` are added and the Drive folder is shared with that service account.

### 2026-04-29 22:40 -04:00

- Added an automated backup system with a protected `/api/cron/backups` route and a daily Vercel Cron schedule.
- Added a `BackupRun` database model to track backup status, destinations, checksums, artifact sizes, record counts, and failure messages.
- Added compressed database snapshot generation and compressed asset-manifest generation, stored under private Vercel Blob backup paths.
- Added backup artifact encryption before upload because the current Vercel Blob store is public-access and must not receive raw database snapshots.
- Added optional Google Drive offsite upload support for encrypted backup artifacts through service-account credentials and `GOOGLE_DRIVE_BACKUP_FOLDER_ID`.
- Documented the required Google Drive `command center` folder setup, including the current connector limitation that the folder must be created/shared manually before offsite uploads are enabled.

### 2026-04-29 14:14 -04:00

- Added middleware-level burst protection for public `/api/exclusive/claim` and `/api/analytics/track` POST requests so obvious repeated traffic is rejected before reaching route handlers.
- Replaced the old in-memory exclusive signup limiter with a Prisma-backed `PublicRateLimit` table so exclusive track claims are durably throttled by both IP address and normalized email address across production server instances.
- Added shared email normalization and validation for public exclusive signups and admin subscriber CRUD, including length, whitespace, domain, and repeated-dot checks beyond the browser `type=email` guard.
- Applied the local SQLite migration and verified the updated SQLite and Postgres Prisma clients generate cleanly.

### 2026-04-29 13:53 -04:00

- Rotated the production `AUTH_SECRET`, re-encrypted the existing admin TOTP secret against the new auth secret, and cleared active production auth sessions so old session cookies are invalidated.
- Converted application-owned server-side production Vercel environment variables to `sensitive` where safe, including admin auth, production database alias, email configuration, asset-driver configuration, and Resend runtime key entries.
- Confirmed provider-managed Vercel Blob/Supabase/Postgres integration variables remain encrypted and should be rotated from their provider dashboards rather than manually overwritten in Vercel.
- Attempted Resend API-key rotation through the official API; the current runtime key is intentionally send-only, so creating/revoking replacement keys must be completed in the Resend dashboard with a key-management-capable account session.
- Re-ran a git-history secret scan and found no committed Resend API keys, Vercel Blob tokens, Postgres URLs, or the known plaintext admin password marker outside documentation/examples.
- Redeployed production and smoke-tested public pages, admin redirect protection, login-page availability, and invalid-login rejection after the rotation.

### 2026-04-29 01:02 -04:00

- Fixed production admin login by replacing the malformed Vercel `ADMIN_PASSWORD_HASH` value that had copied local escaped dollar signs literally from `.env.local`.
- Verified the production username/password step now redirects to `/admin/2fa` on both `vvviruz.com` and the Vercel app URL.
- Updated production `PUBLIC_SITE_URL` and `NEXT_PUBLIC_SITE_URL` to the canonical custom domain `https://vvviruz.com`.

### 2026-04-29 00:04 -04:00

- Configured Resend production email settings in Vercel with `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `ADMIN_TEST_EMAIL`.
- Set the production sender identity to `vvviruz <inquiry@vvviruz.com>` and admin test recipient to `inquiry@vvviruz.com`.
- Verified the pulled Vercel production environment contains the required email variables without exposing secret values.

### 2026-04-28 23:22 -04:00

- Added repeatable production support scripts for exporting the local SQLite data snapshot, importing that snapshot into a Postgres-backed Prisma client, and uploading local media assets to Vercel Blob.
- Updated the asset API route so existing `/api/assets/...` references can resolve from Blob in production when local disk storage is unavailable.
- Updated admin asset listing helpers so site icons and exclusive offer assets can be listed from Blob when `ASSET_STORAGE_DRIVER=vercel-blob`.
- Verified Vercel production env has Postgres, Blob, admin auth, and public-site URL settings populated; Resend-specific email secrets still need to be added before campaign sending is production-ready.
- Pushed the current local data snapshot into production Postgres, including the admin identity for existing TOTP continuity but no active local sessions, and uploaded local media assets to Blob: 12 site icons, 28 covers, 2 backgrounds, 18 audio uploads, and 1 export.

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
- Added durable object-storage support through `ASSET_STORAGE_DRIVER=vercel-blob` and `@vercel/blob`, while preserving local disk storage for local runs.
- Added first-party `/links` analytics tracking for page views, outbound link conversions, CTR, unique visitors, platform breakdowns, referrers, and UTM/source data.
- Built the protected `/admin/attribution` dashboard and added an admin Site Settings control-map panel confirming public copy, images, links, and tracking are editable without code.

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
- Tuned public homepage cards, streaming buttons, About social tiles, Releases, Roadmap, Audience, and shared admin panels so phone layouts stack cleanly while desktop breakpoints remain intact.

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
- Kept the About page aligned with the "site settings drives public copy" rule instead of leaving one-off hardcoded strings in the public UI.

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
- Kept large media assets and generated files on disk under `storage/`.
- Added Prisma scripts, initial migration files, and JSON-to-SQLite import tooling.
- Imported the current local JSON workspace into SQLite and verified the migration counts.

### 2026-04-21 15:26 -04:00

- Rewrote the README into a cleaner public-facing project overview.
- Tightened the positioning so the repo reads well for recruiter and portfolio review.
- Prepared the repository for public visibility.

### 2026-04-21 14:46 -04:00

- Updated WSL and verified the app runs successfully on port `3000`.

### 2026-04-21 01:55 -04:00

- Completed the secure `/admin` lockdown with server-enforced auth, sessions, and TOTP-based 2FA.
