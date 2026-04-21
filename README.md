# vvviruz' command center

`vvviruz' command center` is a local-first creative operating system for managing music releases, building short lyric videos, and organizing promotional copy in one place.

It is intentionally built as a single-owner internal tool rather than a SaaS product. The app prioritizes fast iteration, clean UX, and production-minded admin security over multi-user complexity.

## Project Summary

This project combines a release tracker, a lyric video studio, and a copywriting workspace into one Next.js app with a secure admin boundary under `/admin`.

The core idea is simple: keep the full creative workflow local, fast, and organized.

- plan and track releases
- generate lyric videos with live preview and export
- connect clips and copy directly to releases
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

### Releases

Release planning and execution workspace with:

- release metadata
- stage-based progress tracking
- tasks
- cover art references
- streaming links
- linked lyric clips
- linked copy entries
- pinning and search

### Lyric Lab

Short-form lyric video builder with:

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
- stage checklist progression
- computed snapshot and blockers
- generated clips section
- linked copy section

### Lyric Video Workflow

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

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Remotion
- FFmpeg via `ffmpeg-static`
- FFprobe via `ffprobe-static`
- local Whisper via `@remotion/install-whisper-cpp`
- local JSON/file storage

## Architecture Notes

- Local-first storage under `storage/`
- Single server process
- No cloud storage
- No background worker layer
- No Stripe, auth SaaS, or multi-user system
- Public `/` remains open for future public-site work
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

3. Create local auth env vars in `.env.local`

```bash
AUTH_SECRET=your-generated-secret
ADMIN_USERNAME=owner
ADMIN_PASSWORD_HASH=your-generated-password-hash
ADMIN_TOTP_ISSUER=vvviruz Command Center
ADMIN_SESSION_TTL_HOURS=12
ADMIN_PREAUTH_TTL_MINUTES=10
```

4. Start the app

```bash
npm run dev
```

5. Open:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Docker v1

The repo includes a Dockerized `v1` setup for the secured app.

### Build and run

1. Copy `.env.docker.example` to `.env.docker`
2. Fill in the Docker runtime env vars
3. Start the app

```bash
docker compose up --build -d
```

4. If Whisper models are not installed yet:

```bash
docker compose exec app npm run setup:whisper
```

5. Open:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Useful Commands

```bash
npm install
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
- The GitHub version is source-focused and safe to review publicly.
- The app itself is designed as a private owner-operated command center, not a public SaaS product.

## Recent Updates

### 2026-04-21 15:26 -04:00

- Rewrote the README into a cleaner public-facing project overview.
- Tightened the positioning so the repo reads well for recruiter and portfolio review.
- Prepared the repository for public visibility.

### 2026-04-21 14:46 -04:00

- Updated WSL and verified the Dockerized `v1` app runs successfully on port `3000`.

### 2026-04-21 01:55 -04:00

- Completed the secure `/admin` lockdown with server-enforced auth, sessions, and TOTP-based 2FA.
