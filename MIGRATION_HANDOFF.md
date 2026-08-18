# Workstation Migration Handoff

Prepared on August 18, 2026 for the `vvviruz-command-center-v2` project.

## Repository state

- Git remote: `https://github.com/RegisNobel/vvviruzcommandcenter-v2.git`
- Branch: `main`
- Handoff commit baseline: `3f8e996b0acae172031d58052c94c2f93a0cd523`
- Baseline commit subject: `Scope Spotify import counts to release`
- The working tree was clean and the baseline exactly matched `origin/main` before this handoff document was added.

## Runtime baseline

- Windows with PowerShell
- Node.js `24.14.1`
- npm `11.11.0`
- Python `3.12.10`
- Git `2.54.0.windows.1`
- GitHub CLI `2.97.0`

The repository does not currently pin Node or npm in `package.json`, `.nvmrc`, or a similar version file. Match the versions above for the lowest-risk first setup, then pin supported versions separately if desired.

## Local-only data

The encrypted migration bundle contains:

- `storage/`: the local SQLite database, uploads, release covers, site icons, local production backups, exports, and legacy import material.
- `.artifacts/`: optional retained test and audit artifacts.
- `.env.production.local`: secret environment configuration from the old workstation.
- `MIGRATION_HANDOFF.md`: a copy of this document.
- `MANIFEST.csv`: file paths, sizes, timestamps, and SHA-256 hashes for bundle verification.

The bundle deliberately excludes `node_modules/`, `.next/`, `.codex-temp/`, `.vercel/`, logs, authentication cookies, Git output captures, and Codex credentials/caches.

Treat the encrypted bundle and its password as sensitive. Do not commit the decrypted contents or environment file.

## New workstation setup

1. Install the ChatGPT desktop app, Git, Node.js, Python, and GitHub CLI.
2. Sign into ChatGPT and GitHub using the intended accounts.
3. Clone the repository:

   ```powershell
   git clone https://github.com/RegisNobel/vvviruzcommandcenter-v2.git lyriclab
   Set-Location lyriclab
   ```

4. Copy the encrypted bundle and `decrypt-migration-bundle.ps1` to the new workstation.
5. Run the decryption helper from PowerShell and enter the bundle password when prompted:

   ```powershell
   .\decrypt-migration-bundle.ps1 -EncryptedBundle .\lyriclab-project-data-2026-08-18.zip.aes
   ```

6. Extract the resulting ZIP to a temporary folder. Copy `storage/`, `.artifacts/`, and—only if it is still appropriate—`.env.production.local` into the cloned repository.
7. Prefer signing into Vercel, linking the existing project, and pulling fresh environment configuration. The bundled environment file is a fallback and may contain stale platform-generated values.
8. Install and prepare the project:

   ```powershell
   npm ci
   npm run db:generate
   npm run db:migrate:deploy
   ```

9. Validate the restored workspace:

   ```powershell
   npm run typecheck
   npm run lint
   npm run build
   npm run dev
   ```

10. Confirm the public pages and `/admin/login` load, and verify that expected local releases, uploads, covers, and site icons are present.

## Services to reconnect

- GitHub CLI: run `gh auth login`.
- Vercel: sign in, link the existing project, and pull environment variables.
- ChatGPT/Codex: sign in with the same account, add the cloned folder as a local project, and reconnect GitHub, Vercel, Gmail, and Google Drive plugins if prompted.

Do not copy `~/.codex/auth.json`, sandbox secrets, browser cookies, or the complete Codex home directory. Local Codex tasks and memories remain on the old host unless deliberately migrated; this handoff document is the durable context for starting a fresh task safely.

## Final acceptance check

Do not erase or repurpose the old workstation until all of the following are true:

- Git reports a clean or intentionally changed working tree on the new machine.
- The restored database opens and migrations complete successfully.
- Type checking, linting, and the production build pass.
- The development server starts and the critical public/admin routes work.
- Vercel and GitHub access are confirmed.
- The encrypted archive and password have been stored separately in secure locations.
