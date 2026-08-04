# Breaking Barz access audit and Gate A2 outcome

The initial audit was performed read-only against production project [REDACTED - local credential exposure removed] on 2026-08-04. Gate A2 was subsequently approved and executed during the 2026-08-04 maintenance window.

## Verified final production posture

All six Breaking Barz tables remain owned by `postgres`. RLS is enabled but not forced, no RLS policies exist, and `PUBLIC`, `anon`, `authenticated`, and `service_role` have no table privileges. The trusted `postgres` Prisma path retains CRUD access. Post-hardening counts returned to the preflight baseline after verification cleanup: 17 entries, 17 versions, 0 version sources, 9 categories, 24 entry/category relationships, and 0 submissions.

Direct SQL role testing performed 72 rolled-back SELECT/INSERT/UPDATE/DELETE attempts across the three API roles and six tables; every attempt failed with SQLSTATE `42501`. Eighteen zero-row Data API reads also returned no rows: anon returned HTTP 401 and authenticated/service-role returned HTTP 403, all with safe code `42501`. Direct Data API submission returned HTTP 401 / `42501`.

The trusted Prisma public, submission, versioning, moderation, inventory, backfill, backup, and disposable-restore workflows passed. Gate A3 established that the earlier 11-character observation was Vercel's `[Sensitive]` pull placeholder rather than the underlying value, then rotated production `AUTH_SECRET` to a 43-character base64url value generated from 32 random bytes. Password-plus-TOTP enrollment, logout, repeat login, protected navigation, and session persistence passed. The Breaking Barz admin surface can read and create drafts, but its multi-submit editor currently reduces “Publish revision” to the draft action; production publish/archive/withdraw and moderation verification remain incomplete until that server-action defect is fixed in a separate reviewed deployment. The emergency insecure rollback was not used.

## Verified pre-hardening posture

All six tables are owned by `postgres`, have RLS disabled, and have no policies. Their ACL grants `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, and PostgreSQL 17 `MAINTAIN` to each of `anon`, `authenticated`, and `service_role`. `PUBLIC` has schema usage but no direct table grant. Zero-row requests using the active publishable key returned HTTP 200 for every table, confirming PostgREST/Data API exposure. `pg_graphql` is not installed.

There are no dependent views, materialized views, referencing database functions, security-definer functions, or non-internal triggers for these tables.

The grant origin is verified: the `postgres` default ACL for new public-schema tables grants all table privileges to `anon`, `authenticated`, and `service_role`. Prisma created these tables as `postgres`, while Prisma schemas and migrations do not express RLS. This combination produced the exposure automatically.

Safe aggregate production inventory:

| Table | Rows | Data categories |
| --- | ---: | --- |
| `BreakingBarzEntry` | 17 | Slugs, release/annotation links, public-state pointers and timestamps; all 17 currently published/current |
| `BreakingBarzVersion` | 17 | Versioned excerpt, summary, breakdown, verification metadata; all 17 currently published and no private note is populated |
| `BreakingBarzVersionSource` | 0 | Source labels and URLs |
| `BreakingBarzCategory` | 9 | Category name, slug, description, order, active state; all active |
| `BreakingBarzEntryCategory` | 24 | Entry/category relationship identifiers |
| `BreakingBarzSubmission` | 0 | Fan content, optional name/email, moderation status/note, promotion link |

The absence of current submissions and drafts limits immediate confidentiality impact, but it does not reduce the live unauthorized write/delete/truncate risk or protect future private rows.

## Repository access paths

| Path | Operation | Database role/path | Direct Data API required? |
| --- | --- | --- | --- |
| `/breaking-barz` | Published discovery, filters, pagination | Server component → server-only repository → Prisma `postgres` | No |
| `/breaking-barz/[slug]` | Published current detail and metadata | Server component → server-only repository → Prisma `postgres` | No |
| Public release pages | Published release-linked annotation display | Public release repository → current published Breaking Barz version → Prisma `postgres` | No |
| `sitemap.xml` | Published/current slugs only | Sitemap → server-only repository → Prisma `postgres` | No |
| `/breaking-barz/suggest` | Displays submission form | Public page; no table access | No |
| `POST /api/breaking-barz/submissions` | Validated, rate-limited insert | Public API → server-only repository → Prisma `postgres` | No |
| `/admin/breaking-barz` | All entries, versions, categories, submissions and moderation metadata | TOTP-complete protected page → Prisma `postgres` | No |
| Breaking Barz admin actions | Draft/publish/archive/withdraw and approve/reject | Authenticated server action → Prisma transaction | No |
| Release annotation API | Create/update/publish/archive and synchronize entry/version/categories/sources | Authenticated API → Prisma transaction | No |
| Lyrics/release correction | Withdraw/archive unsafe release-linked entries | Protected repository transaction | No |
| Inventory | Counts only | Server script → Prisma | No |
| Backfill | Dry-run by default; explicit confirmed production write | Server script → Prisma transaction | No |
| Scheduled encrypted backup | Reads all six tables | Trusted Prisma snapshot | No |
| Restore | Upserts all six and repairs current-version/annotation state | Trusted Prisma restore | No |
| Legacy Supabase REST export | Does not include any of the six tables | `service_role` REST script | No current dependency, but incomplete backup |
| Tests | Anchor logic and version/public stability | Local/disposable Prisma database | No |

No `@supabase/supabase-js` dependency or browser `.from(...)`, REST, or GraphQL table query exists. Supabase URL/key variables are configured, but the repository does not consume a browser key for Breaking Barz.

## Required application access

| Operation | Caller | Required rows | Required columns/output |
| --- | --- | --- | --- |
| Public feed/detail/search | Next server | Entry `status='published'`, current version present, not archived/withdrawn, and linked release published; active categories only | Server reads identifiers/state needed to enforce filters; DTO returns curated title, artists, public excerpt/summary/breakdown, public verification label, sources, categories, links, and cover metadata |
| Public submission | Next API server | Insert one validated pending submission | Validated form fields only; ID/status/timestamps generated server-side; no client-selected moderation fields |
| Admin read | TOTP-complete admin via server | All entries, versions, categories, and submissions | Full moderation and version metadata, including optional submitter contact and private review/verification notes |
| Admin create/update | TOTP-complete admin via server | Selected entry/version/category/submission | Validated repository fields; draft/publish/archive/withdraw and approve/reject transitions |
| Category assignment | TOTP-complete admin/release sync via server | Active categories matching normalized slugs | Relationship IDs generated from server lookup; client cannot write join rows directly |
| Maintenance | Trusted scripts | All rows required by inventory/backfill/revalidation | Server-only IDs, state, and content needed by the operation |
| Backup/restore | Trusted backup job/admin restore | All rows | Full database records in encrypted snapshot; raw private submission fields never become public DTOs |

## Direct role decision

| Role | SELECT | INSERT | UPDATE | DELETE/TRUNCATE/MAINTAIN | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `PUBLIC` | Deny | Deny | Deny | Deny | No table privileges |
| `anon` | Deny | Deny | Deny | Deny | Public content and submissions use Next routes, not direct tables |
| `authenticated` | Deny | Deny | Deny | Deny | Application admin auth is not Supabase Auth; no legitimate direct dependency |
| `service_role` | Deny | Deny | Deny | Deny | No current Breaking Barz REST dependency; trusted maintenance uses Prisma |
| Trusted `postgres` owner | Allow | Allow | Allow | Allow as required by repository/restore | Server secret only; retain owner access and do not force RLS |

## Table policy matrix

RLS is enabled with no policies for every table. Thus all non-owner/non-bypass roles are default-denied even if a table grant is accidentally reintroduced. The trusted owner is not subject to RLS. Direct grants are still revoked because `service_role` bypasses RLS and because grants and RLS are separate controls.

| Table | Legitimate operation | Role | Allowed? | Row condition | Column boundary | Application path/rationale |
| --- | --- | --- | --- | --- | --- | --- |
| `BreakingBarzEntry` | Public read | `anon`/`authenticated`/`PUBLIC` | No direct access | N/A | N/A | Next server filters published/current/not withdrawn and returns a DTO |
| `BreakingBarzEntry` | Read/create/update/logical archive/withdraw | trusted server | Yes | Repository validation and selected ID/release relation | Full server record; curated public DTO | Public repository, admin actions, release sync, maintenance, backup/restore |
| `BreakingBarzEntry` | Any | `service_role` | No | N/A | N/A | No repository dependency |
| `BreakingBarzVersion` | Public read | `anon`/`authenticated`/`PUBLIC` | No direct access | Current published version of an eligible entry | Exclude private verification note and internal editorial history from DTO | Next server joins current version only |
| `BreakingBarzVersion` | Version read/create/update/supersede | trusted server | Yes | Entry-scoped transaction | Full server record | Admin draft/publish and release synchronization |
| `BreakingBarzVersion` | Any | `service_role` | No | N/A | N/A | No repository dependency |
| `BreakingBarzVersionSource` | Public read | `anon`/`authenticated`/`PUBLIC` | No direct access | Sources for current published version only | `label`, `url` only in public DTO | Next server join |
| `BreakingBarzVersionSource` | Replace/read/restore | trusted server | Yes | Version-scoped transaction | Full server record | Admin save, backup/restore |
| `BreakingBarzVersionSource` | Any | `service_role` | No | N/A | N/A | No repository dependency |
| `BreakingBarzCategory` | Public read | `anon`/`authenticated`/`PUBLIC` | No direct access | Active categories used by eligible published entries | `id`, `name`, `slug` in DTO | Server discovery filters |
| `BreakingBarzCategory` | Read/maintenance | trusted server | Yes | Active lookup for assignment; all rows for backup | Full server record | Repository, migrations, backup/restore |
| `BreakingBarzCategory` | Any | `service_role` | No | N/A | N/A | No repository dependency |
| `BreakingBarzEntryCategory` | Public read/write | `anon`/`authenticated`/`PUBLIC` | No direct access | N/A | N/A | Relationships are resolved server-side |
| `BreakingBarzEntryCategory` | Replace/read/restore | trusted server | Yes | Entry-scoped and active-category validated | Relationship IDs | Publishing, category filters, backup/restore |
| `BreakingBarzEntryCategory` | Any | `service_role` | No | N/A | N/A | Prevent category manipulation through Data API |
| `BreakingBarzSubmission` | Public insert | `anon`/`authenticated`/`PUBLIC` | No direct access | N/A | N/A | Public Next API validates, rate-limits, and performs trusted insert |
| `BreakingBarzSubmission` | Read/review/update/restore | trusted server | Yes | Pending-only review transition by selected ID | Full record including private contact/review fields | TOTP admin and encrypted backup/restore |
| `BreakingBarzSubmission` | Any | `service_role` | No | N/A | N/A | No repository dependency; prevents PII bypass |

## Threat findings

- **Critical — unrestricted Data API integrity/destruction:** PostgREST exposes direct select/insert/update/delete because `anon` and `authenticated` have those table privileges and RLS is off. An attacker can publish forged content, replace version pointers, alter categories, or delete the corpus.
- **Critical — submission privacy:** the current schema contains optional submitter email/name and private review notes. There are zero rows today, but the first future submission would be anonymously readable and writable without remediation.
- **High — draft/version-history exposure:** direct reads bypass the application's current-published-version selection and would expose future drafts, superseded versions, private verification notes, and unpublished content.
- **High — submission and validation bypass:** direct inserts bypass Zod validation, HTTPS URL normalization, honeypot handling, five-per-hour IP rate limiting, and server-generated moderation defaults.
- **High — relationship/state manipulation:** direct writes to entry, version, current-version pointers, categories, and join rows can make unauthorized content appear public or break release-linked behavior.
- **High — unnecessary latent database privileges:** the ACL also grants truncate, references, trigger, and PostgreSQL 17 maintain. Standard PostgREST CRUD does not itself provide SQL for trigger creation or truncate, and no exposed RPC exists, but these privileges would amplify any future SQL/RPC execution path and have no legitimate browser-role purpose.
- **Medium — enumeration and mass scraping:** Data API access exposes bulk identifiers, release/annotation relationships, version history, timestamps, and the entire public corpus without the 12-row server pagination boundary.
- **Medium — application-role blast radius:** Prisma connects as the `postgres` owner/bypass role. RLS protects browser roles but not a compromised trusted server connection. A dedicated non-owner application role would reduce this risk but is a broader deployment redesign.
- **Medium — public submission abuse remains after ACL remediation:** the server route has a honeypot, validation, and persisted IP rate limit, but no explicit request-byte limit, CAPTCHA, or verified-origin requirement.
- **Medium — incomplete legacy backup path:** `db:export:supabase-rest` omits the six tables. Scheduled encrypted Prisma snapshots include them; operators must not use the legacy export as proof of Breaking Barz recoverability.
- **Low — joins/views/functions:** no views, database functions, security-definer functions, or triggers currently expose or mutate these tables, so there is no additional bypass path to remediate.

## Compatibility plan

Because every live application path uses the `postgres` Prisma connection, enabling non-forced RLS and revoking Data API roles should not change page, API, admin, maintenance, or encrypted backup behavior. Compatibility must still be proven in production-like PostgreSQL before execution and smoked immediately afterward.

Required checks:

1. Published feed, filters, pagination, detail metadata, sitemap, and release-linked annotations remain visible.
2. A draft revision cannot replace the public version until publish.
3. Archived/withdrawn entries and rejected/pending submissions remain invisible publicly.
4. Public submission succeeds through the API, is private, and is rate-limited; direct Data API insertion fails.
5. Direct `anon` and `authenticated` SELECT/INSERT/UPDATE/DELETE/TRUNCATE/MAINTAIN fail for all six tables.
6. TOTP admin can create a standalone entry, save/publish a version, assign categories, archive/withdraw, review/reject/publish a submission, and edit release-linked annotations.
7. Backfill dry-run, inventory, scheduled encrypted snapshot, disposable restore, and post-restore public resolution succeed.

## Approved decisions and follow-ups

1. The product owner confirmed no direct Data API consumer and approved the server-only model with no RLS policies or API-role table grants.
2. Optional submitter name/email may continue to be collected. Rejected-submission contact data should be removed after 90 days in a separate reviewed retention implementation.
3. Broad `postgres` public-schema default privileges remain unchanged. A separate infrastructure gate must revoke unsafe defaults; deployment reviews must inspect ACL and RLS on every new table until then.
4. Gate A3 rotated production `AUTH_SECRET`, invalidated existing sessions, and completed controlled TOTP re-enrollment and repeat login. The remaining admin compatibility blocker is the Breaking Barz multi-submit editor defect described above.
