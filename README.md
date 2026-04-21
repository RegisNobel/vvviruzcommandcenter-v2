# vvviruz' command center

`vvviruz' command center` is a local-first creative workspace built with Next.js, TypeScript, Tailwind CSS, Remotion, FFmpeg, and local Whisper transcription. It runs as a single-user, single-process app with local JSON and file storage only.

This README now tracks the project as it exists today and should be updated whenever routes, workflows, or major features change.

## Recent Change Log

### 2026-04-21 15:17 -04:00

- Created the standalone private GitHub repository:
  - `RegisNobel/vvviruz-command-center`
- Pushed the current `v1` source snapshot to `main`.
- Published the app as its own repo instead of leaving it nested as an untracked folder inside the parent `Codex` workspace.

### 2026-04-21 15:13 -04:00

- Initialized `lyriclab` as its own standalone git repository instead of leaving it as an untracked folder inside the parent `Codex` repo.
- Tightened `.gitignore` so GitHub publishing excludes local auth state, release/project/copy data, uploaded media, cover art, generated exports, Whisper assets, and local troubleshooting artifacts.
- Prepared the app for a `v1` GitHub publish as a separate repository named `vvviruz-command-center`.

### 2026-04-21 14:46 -04:00

- Updated the local WSL runtime to `2.6.3.0`.
- Verified the Docker Desktop engine is reachable from an elevated shell.
- Added a local `.env.docker` file using the raw admin auth values needed by Docker Compose.
- Built and started the Dockerized `v1` app successfully with Docker Compose.
- Verified the containerized app responds on:
  - `/`
  - `/admin/login`

### 2026-04-21 14:07 -04:00

- Confirmed firmware virtualization is now enabled on the machine.
- Rechecked Docker client state after the BIOS update:
  - Docker CLI is installed
  - Docker daemon is still unavailable because Docker Desktop is not installed/running yet
- Retried the Docker Desktop install multiple times after virtualization was enabled.
- Current blocker is the Windows Docker Desktop installer failing at the admin/UAC handoff from this session, so the full Docker backend is still not up.

### 2026-04-21 02:45 -04:00

- Enabled the Windows WSL platform components using `wsl --install --no-distribution`.
- Rechecked Docker backend prerequisites after the WSL install.
- Current runtime blocker remains firmware virtualization being disabled in BIOS/UEFI.
- Docker Desktop still cannot be fully installed and started from this session until virtualization is enabled and the installer is completed interactively as admin.

### 2026-04-21 02:41 -04:00

- Checked the local Windows Docker runtime prerequisites for container execution.
- Confirmed:
  - WSL default version is `2`
  - no WSL distribution is installed yet
  - firmware virtualization is currently disabled on this machine
- Attempted to install Docker Desktop for the full runtime/backend, but the Windows installer did not complete from this session.
- Current blocker for actually running containers locally is BIOS/UEFI virtualization plus completing the Docker Desktop install interactively as admin.

### 2026-04-21 02:37 -04:00

- Installed the local Docker CLI toolchain on the current Windows machine using Winget.
- Installed:
  - Docker CLI
  - Docker Compose
- Wired the Compose binary into Docker's CLI plugin path so `docker compose` resolves correctly for the Dockerized `v1` workflow.

### 2026-04-21 02:29 -04:00

- Dockerized the current secured admin build as container `v1`.
- Added a production-oriented `Dockerfile` with:
  - Node 22
  - multi-stage build
  - non-root runtime user
  - Chromium/Remotion runtime libraries for video export
  - startup healthcheck
- Added `docker-compose.yml` for local container runs on port `3000`.
- Added `.env.docker.example` for Docker-specific runtime secrets/config.
- Added a Docker entrypoint that creates the required local storage and Whisper directories on startup.
- Added `.dockerignore` and updated `.gitignore` so Docker/local secret files stay out of source control and build context.

### 2026-04-21 02:02 -04:00

- Updated the local admin credential configuration to the newly requested admin username.
- Added a local `.env.local` admin config with a fresh `AUTH_SECRET` and a new secure password hash.
- Updated `.gitignore` so `.env.local` stays out of source control.

### 2026-04-21 02:06 -04:00

- Fixed the local admin password hash env format by escaping the literal `$` separators inside `ADMIN_PASSWORD_HASH`.
- Added setup guidance that generated scrypt hashes must keep their literal `$` delimiters when stored in `.env.local`.

### 2026-04-21 01:55 -04:00

- Milestone 2: Admin Lockdown is implemented.
- The command center now lives under `/admin` instead of the public root.
- Public `/` is now reserved for the future vvviruz website and stays accessible without auth.
- Added server-enforced admin authentication with:
  - username + password
  - TOTP/app-based 2FA
  - httpOnly session cookies
  - server-side session storage
  - logout and session invalidation
  - basic login/TOTP throttling
- Added auth routes and pages:
  - `/admin/login`
  - `/admin/2fa`
  - `/admin/setup-2fa`
  - `/admin/logout`
- Added middleware protection for `/admin` routes and server-side auth checks for protected admin pages and private API routes.
- Existing command center pages now render under `/admin/*`, and the old top-level internal routes redirect into the protected admin namespace.
- Added admin bootstrap helpers:
  - `npm run generate:auth-secret`
  - `npm run hash:admin-password`
- Added `.env.example` with the required admin auth variables.

### 2026-04-20 23:59 -04:00

- Release progress now counts all non-exempt release fields plus stage and task checkboxes, so a release cannot reach `100%` while any release field is blank or any checkbox remains unchecked.
- `Generated Clips` and `Copy Pairs` remain exempt from release progress completion rules.
- Streaming link buttons in the release metadata panel no longer show the extra `Open` text.
- Going forward, every new request/change should add a timestamped entry to this README.

## Current Modules

### 1. Public Site Placeholder

- Route: `/`
- Purpose: reserved public vvviruz website entry point
- Includes:
  - simple public placeholder page
  - no admin UI
  - no auth required

### 2. Admin Command Center

- Route: `/admin`
- Purpose: protected internal creative workspace
- Includes:
  - authenticated admin shell
  - top navigation bar
  - links into Analytics, Lyric Lab, Copy Lab, Photo Lab, and Releases
  - logout action

### 3. Admin Auth

- Routes:
  - `/admin/login`
  - `/admin/2fa`
  - `/admin/setup-2fa`
  - `/admin/logout`
- Purpose: secure admin sign-in, TOTP enrollment, TOTP challenge, and logout

### 4. Analytics

- Route: `/admin/analytics`
- Purpose: blank placeholder workspace for future analytics buildout

### 5. Lyric Lab

- Route: `/admin/lyric-lab`
- Purpose: build short lyric videos for personal use
- Current workflow:
  1. Release Context
  2. Audio
  3. Trim
  4. Transcribe
  5. Edit
  6. Style
  7. Export

### 6. Photo Lab

- Route: `/admin/photo-lab`
- Purpose: placeholder workspace for future cover art creation
- Includes:
  - navbar access
  - entry point from the Releases cover art section
  - placeholder page for future buildout

### 7. Copy Lab

- Route: `/admin/copy-lab`
- Purpose: build and organize hook/caption pairs
- Includes:
  - copy list page
  - create copy page
  - copy detail editor
  - optional release linking
  - standalone neutral copy support

### 8. Releases

- Route: `/admin/releases`
- Purpose: track song and rollout progress for a release
- Includes:
  - releases list
  - release search
  - create release page
  - release detail editor

## What We Have Built So Far

### Command Center Shell

- App renamed from `LyricLab` to `vvviruz' command center`
- Global dark command-center theme applied across the app
- Public `/` is now a placeholder for the future vvviruz website
- Protected command center home now lives at `/admin`
- Global sticky admin navbar added inside the protected admin layout
- Overview page added as the admin workspace home
- Links added for:
  - Overview
  - Analytics
  - Lyric Lab
  - Copy Lab
  - Photo Lab
  - Releases
- Legacy internal top-level routes now redirect into `/admin/*`

### Admin Lockdown Features

- `/admin` and all nested admin pages are protected by middleware
- Protected admin pages also verify the session on the server before rendering
- Added single-admin username + password authentication
- Added TOTP/app-based 2FA with a two-step flow:
  1. username/password verification
  2. TOTP verification
  3. authenticated admin session creation
- Added initial TOTP enrollment flow at `/admin/setup-2fa`
- TOTP secret is stored encrypted at rest in local storage
- Passwords are verified against a secure scrypt hash
- Session state is stored server-side in local storage
- Session cookie is:
  - httpOnly
  - same-site `lax`
  - secure when the request is served over HTTPS
- Added logout with immediate session invalidation
- Added basic request throttling for login and TOTP attempts
- The 2FA/session structure is kept modular so additional second-factor methods can be added later
- Private admin API routes are server-protected and reject unauthenticated requests
- Public `/` remains accessible without auth
- Unauthenticated access to `/admin/*` is redirected to `/admin/login`

### Analytics Features

- Blank analytics page at `/admin/analytics`
- Global nav access from the command center
- Placeholder workspace reserved for future reporting buildout

### Lyric Lab Features

- Sequential workflow instead of a single crowded screen
- Immediate project creation when audio is selected
- New Release Context first step before audio upload
- New projects can optionally be attached to an existing release from the start
- Project title defaults to the uploaded audio filename
- Project progress autosaves locally as you move through the workflow
- Lyric Lab now autosaves every minute and also includes a manual save button
- Lyric Lab projects now support an optional `release_id`
- Standalone Lyric Lab projects are still fully supported
- Audio upload for `mp3`, `wav`, and `m4a`
- Forced trim flow for clips longer than 30 seconds
- Waveform trim editor with draggable handles
- FFmpeg trimming and normalization
- Local Whisper transcription
- Language options:
  - Auto Detect
  - English
  - French
  - Spanish
- Better support for mixed-language and bilingual lyrics
- Lyric editing:
  - edit text
  - adjust timing
  - split lines
  - merge lines
  - manual sync fixes
- Style editing:
  - font
  - size
  - color
  - stroke
  - shadow
  - alignment
  - animation style
- Animation options:
  - fade
  - slide up
  - pop
  - typewriter
  - karaoke highlight
- Live Remotion preview
- Preview aspect ratio options:
  - `9:16`
  - `16:9`
- Drag-to-position lyric block in preview
- Background options:
  - solid color
  - gradient
  - motion loop
  - photo upload from local machine
  - video upload from local machine
- Removed the mirrored/reflection ghost lyric lines
- Export features:
  - MP4 export
  - `720p`
  - `1080p`
  - H.264 video
  - AAC audio
- SRT export
- Local project library with:
  - numbered projects
  - load button
  - delete button
  - current project highlighting
  - new project button
- Release-linked clip opening from Release Detail via `/admin/lyric-lab?projectId=...`

### Stability Fixes Added

- Fixed local Whisper model path detection
- Fixed preview audio/video seekability by adding proper `Range` support on local media routes
- Fixed style screen player interaction by making the drag overlay non-blocking
- Fixed CSS/dev-server reload issues by restarting and revalidating the local dev server during testing

### Releases Features

- Releases list page
- Release search on the home/list page
- Releases can be pinned to the top of the list
- Release cards are clickable to open details directly
- Release list progress bars now shift by progress level:
  - below 50% red
  - 50% to 99% amber
  - 100% green
- New release page
- Release detail page
- Autosave on detail edits
- Release detail now autosaves every minute and also includes a manual save button
- Progress calculation based on stage completion and tasks
- Manual status controls removed from release creation and basic info
- Release metadata now includes optional `UPC` and `ISRC`
- Release Detail now includes blank-ready streaming links for:
  - Spotify
  - Apple Music
  - YouTube
- Release metadata panel renders streaming links as clickable branded buttons when links are present
- Releases can now be deleted
- Delete actions now use red danger buttons and yes/no confirmation prompts
- Deleting a release automatically unlinks connected Lyric Lab projects and Copy Lab entries instead of deleting them
- Cover art section now includes:
  - local upload
  - `Create Cover Art` button linking to Photo Lab
- Release Detail now includes a `Generated Clips` section
- `Generated Clips` automatically lists all Lyric Lab projects whose `release_id` matches the release
- The `Create Clip` action lives inside the `Generated Clips` section
- `Create Clip` opens Lyric Lab with the current release preselected in the Release Context step
- Linked Lyric Lab projects can be:
  - opened in Lyric Lab
  - unlinked without being deleted
- Release Detail now includes a computed `Release Snapshot` block near the top
- Release Detail now also includes a linked copy section for Copy Lab items
- Linked Copy Lab items can be:
  - opened in Copy Lab
  - unlinked without being deleted
- Release data can now be synced locally from:
  - `storage/releases/vvviruz_100_song_catalog.txt`
  - `storage/releases/vvviruz_song_index.txt`
- Catalog sync behavior:
  - creates missing releases
  - skips duplicates
  - fills matching concept details when the release does not already have a meaningful concept
- Older matchup-style release names can be normalized so any `vs.` record uses a `Multiversus:` prefix

### Copy Lab Features

- Copy list page at `/admin/copy-lab`
- New copy page at `/admin/copy-lab/new`
- Copy detail page at `/admin/copy-lab/[id]`
- Basic CRUD for hook/caption pairs
- Copy detail now autosaves every minute and also includes a manual save button
- Each copy currently supports:
  - `id`
  - `release_id`
  - `hook`
  - `caption`
  - `type`
  - `created_on`
  - `updated_on`
- Supported copy types:
  - `Curiosity`
  - `Contrarian/Opinion`
  - `Relatable/Pain`
  - `Listicle/Numbered`
  - `Direct/Actionable`
  - `Mistake/Regret`
  - `The "Before/After" or "Result"`
  - `Neutral`
- Copy can be created as:
  - linked to an existing release
  - standalone with `No Release / Standalone`
- `neutral` copy is supported for standalone ideas that do not belong to a release yet
- Release linking is one-to-one:
  - a copy belongs to one release or none
- Release Detail automatically lists all linked copies whose `release_id` matches that release

Each release currently supports:

- `id`
- `title`
- `collaborator`
- `collaborator_name`
- `cover_art`
- `upc`
- `isrc`
- `lyrics`
- `type`
  - `nerdcore`
  - `mainstream`
- `release_date`
- `concept_details`
- stage completion checkboxes:
  - `concept_complete`
  - `beat_made`
  - `lyrics_finished`
  - `recorded`
  - `mix_mastered`
  - `published`
- `tasks`
- `created_on`
- `updated_on`

Release detail page includes:

- editable title
- editable type
- editable release date
- collaborator yes/no selector
- collaborator name field when needed
- editable `UPC`
- editable `ISRC`
- multiline concept details field
- multiline lyrics field
- local cover art upload
- create-cover-art link into Photo Lab
- stage checklist
- simple task list
- metadata panel for id, timestamps, `UPC`, and `ISRC`
- metadata panel for id, timestamps, `UPC`, `ISRC`, and streaming links
- delete release action

## Local Storage

All app data is stored locally under `storage/`.

Current storage folders:

- `storage/auth`
- `storage/uploads`
- `storage/exports`
- `storage/projects`
- `storage/copies`
- `storage/backgrounds`
- `storage/release-covers`
- `storage/releases`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Remotion
- FFmpeg via `ffmpeg-static`
- FFprobe via `ffprobe-static`
- local Whisper via `whisper.cpp`
- local JSON file storage

## Commands

```bash
npm install
npm run generate:auth-secret
npm run hash:admin-password -- "your-password"
npm run setup:whisper
npm run sync:releases
npm run normalize:releases
npm run dev
npm run lint
npm run build
npm run typecheck
docker compose up --build
docker compose exec app npm run setup:whisper
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Install local Whisper and the model files:

```bash
npm run setup:whisper
```

3. Generate an auth secret:

```bash
npm run generate:auth-secret
```

4. Generate a password hash for the admin account:

```bash
npm run hash:admin-password -- "your-password"
```

5. Create local auth env vars in `.env.local` or your shell:

```bash
AUTH_SECRET=your-generated-secret
ADMIN_USERNAME=owner
ADMIN_PASSWORD_HASH=your-generated-password-hash
ADMIN_TOTP_ISSUER=vvviruz Command Center
ADMIN_SESSION_TTL_HOURS=12
ADMIN_PREAUTH_TTL_MINUTES=10
```

When you paste a generated `ADMIN_PASSWORD_HASH` into `.env.local`, keep the literal `$` separators escaped as `\$` so Next.js env expansion does not corrupt the stored hash.

6. Start the app:

```bash
npm run dev
```

7. Open the public site and the admin area:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

8. On the first successful username/password login, enroll TOTP at `/admin/setup-2fa`.
9. On later logins, the username/password step will send you to `/admin/2fa`.

## Docker v1 Setup

This repo now includes a Dockerized `v1` runtime for the secured admin build.

Files added for Docker:

- `Dockerfile`
- `docker-compose.yml`
- `docker/entrypoint.sh`
- `.env.docker.example`
- `.dockerignore`

### Docker Notes

- The Docker image is tagged as `vvviruz-command-center:v1`.
- The container keeps local-first behavior by bind-mounting:
  - `./storage` -> `/app/storage`
  - `./whisper.cpp` -> `/app/whisper.cpp`
- This means releases, clips, auth state, uploads, exports, and Whisper models stay on your machine and survive container restarts.
- Public `/` stays public, and the protected admin area remains under `/admin`.

### Docker Env File

1. Copy `.env.docker.example` to `.env.docker`
2. Fill in:
   - `AUTH_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - optional TOTP/session settings

For `.env.docker`, keep the password hash in raw `scrypt$...$...` format. Do not escape the `$` delimiters there.

### Docker Run

1. Build and start the container:

```bash
docker compose up --build
```

2. Open:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

3. If Whisper is not installed in `./whisper.cpp` yet, run:

```bash
docker compose exec app npm run setup:whisper
```

4. If you want the container in the background, use:

```bash
docker compose up --build -d
```

5. To stop it:

```bash
docker compose down
```

## Example Workflows

### Admin Sign-In

1. Open `/admin/login`
2. Enter the configured admin username and password
3. If TOTP is not enrolled yet, finish setup at `/admin/setup-2fa`
4. If TOTP is already enrolled, enter the current authenticator code at `/admin/2fa`
5. After successful verification, use the protected admin routes normally
6. Use the navbar `Logout` action to invalidate the session

### Analytics

1. Open `/admin/analytics`
2. Use the placeholder workspace as the future destination for reporting features

### Lyric Lab

1. Open `/admin/lyric-lab`
2. Choose whether the project should attach to an existing release or stay standalone
3. Upload audio
4. Trim if the clip is longer than 30 seconds
5. Run transcription
6. Edit the lyrics and timing
7. Choose styles, aspect ratio, and background
8. Drag the lyric block into place
9. Preview the result live
10. Export MP4 or SRT

### Releases

1. Open `/admin/releases`
2. Use the release search bar if you need to find a release quickly
3. Create a new release
4. Set type, collaborator, release date, and optional metadata like `UPC` and `ISRC`
5. Add concept details
6. Add lyrics
7. Upload cover art or jump into Photo Lab
8. Check off stages as they are completed
9. Review the computed `Release Snapshot` block for stage, next action, and blockers
10. Use `Create Clip` to open Lyric Lab with this release preselected
11. Review `Generated Clips` for any Lyric Lab projects attached to this release
12. Open a linked project in Lyric Lab or unlink it without deleting it
13. Add and complete simple tasks
14. Watch progress update automatically

### Release Sync

1. Drop the catalog file into `storage/releases/vvviruz_100_song_catalog.txt`
2. Drop the song index file into `storage/releases/vvviruz_song_index.txt`
3. Run `npm run sync:releases`
4. Open `/admin/releases` and use search to review imported releases quickly

### Release Title Normalization

1. Run `npm run normalize:releases`
2. Refresh `/admin/releases`
3. Any older matchup title using `vs.` will be normalized into the `Multiversus:` naming style

### Copy Lab

1. Open `/admin/copy-lab`
2. Create a new copy pair
3. Write the hook
4. Write the caption
5. Choose the copy type
6. Attach it to a release or keep it standalone
7. Open the detail page to edit or delete it later
8. Review linked copies from the matching Release Detail page

## Notes

- This is not a SaaS app.
- There is no public signup flow, no multi-user system, no payments, no subscriptions, no cloud storage, and no Redis queue layer.
- There is now one private authenticated admin account protected by username/password + TOTP.
- Everything runs locally or in one Next.js server process.
- `Auto Detect` is the recommended transcription option for mixed-language lyrics.
- Existing private admin APIs currently remain under `/api/*`, but they are server-protected and reject unauthenticated requests.
- Backup/recovery codes and alternate 2FA delivery methods are not implemented yet.
- Build and typecheck should be run in order when `.next/types` needs to be refreshed:

```bash
npm run build
npm run typecheck
```

## Maintenance Rule Going Forward

When we add or change any major route, workflow, data model, styling system, or export/transcription behavior, update this README in the same pass so it stays accurate, and add a date/time-stamped entry to the `Recent Change Log`.
