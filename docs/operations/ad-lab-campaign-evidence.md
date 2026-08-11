# Ad Lab campaign evidence contract

## Evidence layers

`AdImportBatch` is the logical export bundle. `MetaImportFile` and `MetaImportFileRow` retain immutable file/view/row provenance. A `MetaDailySourceObservation` is the immutable bundle-aware merge of compatible daily source rows and records the contributing file and row IDs. `MetaDailyResolution` is only a mutable pointer to the current winning source observation; every pointer change appends a `MetaDailyResolutionEvent`.

Legacy Ad Lab batches default to `AGGREGATE_SNAPSHOT`, `campaignIntervalEligible=false`, and `LEGACY_AGGREGATE_SNAPSHOT`. Their existing `AdCreativeReport` and Copy Lab links remain unchanged.

## Export classes

`AGGREGATE_SNAPSHOT` accepts rolling, fixed-period, release-to-date, and full-campaign exports for descriptive creative history. It never creates canonical daily facts or exact interval suggestions.

`DAILY` core timing eligibility is evaluated from the Delivery/spend view only. It requires daily start/end dates, stable account/campaign/ad-set/ad IDs, non-null authoritative daily spend, a consistent currency, an IANA account timezone (from Meta or the reviewed account registry), an internally consistent stable-ID hierarchy, and no conflicting Delivery facts for the same ad/day. Video, engagement, reach, URL parameters, delivery-status semantics, identical optional coverage, and a trustworthy source-as-of timestamp are not core requirements. Account/campaign/ad-set/ad names are labels only.

Canonical identity is metric-family-specific:

- Spend: `accountId | campaignId | adSetId | adId | metricDate | SPEND | currency`. Attribution and result dimensions cannot duplicate spend.
- Attribution-sensitive results: `accountId | campaignId | adSetId | adId | metricDate | ATTRIBUTION_RESULT | attributionSetting | resultMetricKey`.
- Delivery: descriptive source evidence only. It has no canonical historical fact identity in V1 because the reviewed exports do not prove that the value describes the reporting day.

Winner precedence is strict by provenance: `META_EXPORT` > `USER_CONFIRMED` > `IMPORT_ACCEPTED_FALLBACK` > `UNKNOWN`. Only observations at the same trust rank compare `sourceAsOf`, then `acceptedAt`, then stable observation ID. A later user-confirmed or upload-fallback clock value cannot outrank a valid Meta-export timestamp. Corrected exports can supersede earlier facts, but never delete them. Withdrawn/replaced bundles are excluded and their affected keys are recalculated.

## Source-view ownership and coverage

The four supported source views have explicit roles: Delivery is `CORE_TIMING`; Video, Engagement, and Reach are optional enrichment. Every source row and value remains immutable even when a copied value is reconciled. Each file persists its own earliest/latest date, observed and expected date counts, ad count, row count, missing-core-date count, and coverage state. The batch separately exposes the Delivery timing range and the common intersection. A timing day outside optional coverage remains valid; absent enrichment is unknown/unavailable and is never synthesized as zero.

| Field or metric | Requirement | Authoritative view | Other allowed views | Conflict behavior |
| --- | --- | --- | --- | --- |
| Account/campaign/ad-set/ad IDs and names | IDs required for core timing; names descriptive | Delivery | Video, engagement, reach | A Delivery hierarchy conflict blocks timing. An optional source from another account or with contradictory hierarchy is rejected/degraded; labels remain descriptive. |
| Reporting start/end | One calendar day per Delivery row | Delivery | Video, engagement, reach | Optional views may cover any compatible subset of the Delivery window. Their absence or shorter windows do not discard timing dates. |
| Amount spent and currency | Spend and currency required for core timing | Delivery | Video when exported | Delivery creates the sole canonical spend fact. An identical optional copy reconciles; a different copy is retained as `CROSS_VIEW_SPEND_MISMATCH`, degrades enrichment, and does not invalidate otherwise valid core timing. Conflicting Delivery facts block timing. |
| Attribution setting | Required when attribution-sensitive results are present | Delivery | Engagement | Disagreement blocks result resolution but cannot duplicate spend. |
| Results and result indicator/type | Optional | Delivery | None unless explicitly mapped | The indicator normalizes to `resultMetricKey`; different result keys remain distinct, while disagreement for the same key is persisted and blocks eligibility. |
| Delivery/status | Optional, descriptive | Delivery | None | Retained as source evidence; never used to infer historical pause/resume boundaries. |
| URL parameters | Optional | Delivery | Engagement | Disagreement is retained and warned; it does not alter canonical metric identity. |
| Video metrics | Optional | Video | None | Video owns its play and completion metrics; duplicate copies reconcile without summing and conflicts are retained. |
| Engagement metrics | Optional | Engagement | None | Engagement owns reactions, comments, saves, shares, clicks, and follows; conflicts are retained. |
| Reach/frequency/CPM | Optional | Reach | Delivery | Reach owns reach-family metrics; duplicates reconcile without summing and conflicts are retained. |

## Real export validation

The Desktop files were replaced after Gate E0.5, so Gate E0.6 revalidated their current bytes instead of reporting the older 413-row snapshot. The supplied Engagement and Video filenames are currently byte-identical; exact duplicate-file association is rejected and there is no distinct Video enrichment source in the current bundle. Header detection identifies the three unique files as Reach (60 rows, 2026-07-21 through 2026-08-09), Engagement (60 rows, the same 20 dates), and Delivery (210 rows, 2026-07-11 through 2026-08-09). All 330 unique rows are daily, cover seven ads, contain complete stable IDs, and have no hierarchy conflicts.

The current Delivery view provides 210 core rows, 30 dates, seven ads, and 210 canonical spend facts. Reach and Engagement provide a 20-day common enrichment intersection and are each missing ten dates relative to core. With no reviewed timezone the only core blocker is `TIMEZONE_MISSING_OR_AMBIGUOUS`. A non-production simulation using `America/New_York` made the same Delivery facts core eligible, but that simulation is not an assertion of the real Meta account timezone. Source-as-of remains explicitly `UNKNOWN` and does not block storage or timing eligibility.

The files use `Amount spent (USD)` rather than a standalone Currency field, so the parser persists `USD` with origin `METRIC_HEADER`. They contain no account timezone and no trustworthy export/as-of timestamp. An administrator must supply a reviewed IANA timezone and, when Meta exposes no export timestamp, may supply a reviewed source-as-of classified as `USER_CONFIRMED`; upload time remains `IMPORT_ACCEPTED_FALLBACK`. Delivery values remain descriptive because the export does not prove that status is historical for each reporting day.

The required core Ads Manager configuration is: Ad reporting level; Time breakdown = Day; Account ID/name; Campaign ID/name; Ad set ID/name; Ad ID/name; Reporting starts/ends; Amount spent and currency; and account timezone either in source or in the reviewed registry. Attribution setting plus result fields are required only when attribution-sensitive result facts are used. Optional enrichment views may be uploaded weekly or independently and may cover a subset of the timing range.

## Calendar and timezone semantics

Meta's source reporting date is stored verbatim as `YYYY-MM-DD`; `metricDate` is the same calendar label represented as UTC midnight for cross-provider database compatibility. It is not an instant and is never shifted into another timezone. The source account timezone and normalized IANA timezone are stored separately, with provenance `META_SOURCE`, `USER_CONFIRMED`, or `UNKNOWN`.

PromotionCampaign interval dates and Spotify observation dates use the same inclusive calendar-label comparison. Dashboard points render the stored label. No UTC conversion is used to move a Meta day to an adjacent date. `MetaAccountTimezoneResolution` stores an immutable reviewed chain by stable Meta Account ID, including origin, confirmer, confirmation time, current/superseded state, and replacement reason. A compatible current resolution is reusable; a conflicting source or requested change requires explicit review and supersession. Browser location, geography, currency, filename, and upload time are never timezone evidence.

## Day states and delivery semantics

Positive canonical daily spend is `ACTIVE_EVIDENCE`; the first and last observed positive days are `FIRST_ACTIVE_EVIDENCE` and `LAST_ACTIVE_EVIDENCE`; an explicit zero is `EXPLICIT_ZERO`; a run may be described as `ZERO_RUN`; renewed positive evidence is `ACTIVE_EVIDENCE_RESUMES`; and no eligible fact is `UNKNOWN`. Missing is never zero. These are evidence primitives, not asserted campaign boundaries. Unknown gaps do not close a campaign. Explicit zeroes may split low-confidence suggestions but do not confirm a pause. Delivery text is retained as descriptive evidence only because exports may repeat current object status beside historical metrics; it does not independently infer pause/resume dates.

Generated suggestions use a stable suggestion key, generation version, and source-resolution fingerprint. Recalculation appends replacement evidence and marks stale suggestions `SUPERSEDED`; it never rewrites historical evidence or product-owner-confirmed intervals. Withdrawal recalculates from the remaining canonical observations and can restore the earlier suggestion set.

## Import lifecycle

Upload is limited to 8 files, 5 MiB per file, and 20 MiB per bundle. Inputs must be UTF-8 CSV. Filenames are sanitized for metadata; opaque UUID object keys are used for `ads-preview` and `ads-raw`. Preview files are private and bound to an encrypted, administrator-specific, 15-minute token. Commit re-reads every object, verifies SHA-256/size/bundle hash, reparses with the current parser contract, and requires final review plus warning acknowledgement.

Exact bundle and constituent-file duplicates are blocked; commit idempotency returns the original successful import. Permanent raw objects are uploaded before the database transaction and deleted if it fails. Accepted raw files expire after `ADS_RAW_FILE_RETENTION_DAYS` (30 by default); cleanup never deletes normalized evidence. Formula-leading cells produce a warning and are never included in a raw-row browser preview or logs.

## External campaign links

`MetaPromotionLink` is immutable decision history with `SUGGESTED`, `CONFIRMED`, `REJECTED`, and `REVOKED` states linked by `supersedesLinkId`. Every link has one stable scope identity: `CAMPAIGN` = account/campaign, `AD_SET` = account/campaign/ad set, and `AD` = account/campaign/ad set/ad. Names are labels only. When multiple current links exist for one internal campaign, evidence resolution uses `AD` before `AD_SET` before `CAMPAIGN` and excludes a broader scope covered by a confirmed descendant.

Different child scopes under one shared external campaign are marked `SHARED_EXTERNAL_CAMPAIGN` and `EXTERNAL_SCOPE_ONLY`; their spend remains isolated to the stable child scope. Confirming the exact same child scope against another internal campaign requires a separate explicit confirmation and marks both immutable replacement links `SHARED_EXTERNAL_SCOPE`, `UNALLOCATED_SHARED`, and ambiguous. An exact shared scope may provide descriptive evidence but cannot present duplicated spend as independently attributable. Scope changes append a superseding link and audit event; they never rewrite prior decisions. Confirmed Stage 7 intervals remain independent.

Only current confirmed links can generate campaign evidence from core-timing-eligible canonical Delivery facts. Optional enrichment may decorate analysis but never decides activity. Suggested links are non-authoritative. Generated intervals remain `SUGGESTED`; product-owner-confirmed `CampaignActiveInterval` rows remain the sole retention segmentation authority.

## Gate E0.8 dual-release validation

The final Mahoraga bundle is frozen by `meta-daily-mahoraga-2026-08-10.json` with fingerprint `1bfc3d1bae9e75815e59b5a987e6246fe39a4724533f239eb3a9dd5dfdc25b5a`. Its Delivery view contains 852 complete daily ad facts across 12 ads and 71 dates (2026-06-01 through 2026-08-10): 110 positive, 742 explicit zero, and USD 827.18. The first positive day is 2026-06-10. Each enrichment view contains the same 121 compatible identities; the remaining 731 core-only facts are all zero spend. The reviewed historical revision changes one 2026-08-10 fact from USD 2.71 to USD 3.84, increasing the bundle total from USD 826.05 to USD 827.18. The prior artifact was not supplied to this gate, so that comparison remains product-owner-reviewed provenance while both current Delivery and Video values are independently verified.

The disposable PostgreSQL dual-release rehearsal imported the prior Mahoraga revision, current Mahoraga bundle, and frozen Game Over bundle over the 17-batch/150-report/109-copy-link legacy baseline. Game Over resolved to 210 facts and USD 283.48 only; Mahoraga resolved to 852 facts and USD 827.18 only; their canonical identity intersection was zero. Explicit parent-campaign scope returned the combined 1,062 facts, while no-link/name-only matching returned none. Withdrawing the current Mahoraga revision restored the prior USD 2.71 observation without changing Game Over. Backup/restore preserved scoped links and audits exactly, 27 direct-role reads were denied, raw expiry preserved normalized observations, and no confirmed campaign interval was created.

## Ranking, security, backup, and cleanup

Ad Performance ranking uses only canonical Delivery daily spend when eligible facts exist and shows the exact analysis window. Optional copied spend is never counted. Currency-compatible facts are summed; conflicting currencies remain segmented and monetary ranking is unavailable. Aggregate-only overlapping history uses the latest snapshot per ad, never an additive sum. Because different ads can have different latest reporting windows, the UI calls this `Latest observed snapshot spend`, explicitly says it is not a directly comparable current-spend leaderboard, and exposes every observation's reporting period and as-of date.

All APIs require the existing authenticated, TOTP-complete admin session and use server-side Prisma. New PostgreSQL tables enable RLS, define no browser policies, and revoke `PUBLIC`, `anon`, `authenticated`, and `service_role`. Raw bytes and object keys are never logged or returned to the browser. Campaign/link mutations scope the link ID to the route's internal campaign ID.

Database snapshots include bundles, files (references only), file rows, daily source observations, resolutions, supersession events, account-timezone resolution history, external links, and audits. Raw bytes remain in private object storage. Restore rehydrates relationship chains in dependency order.

## Controlled deployment prerequisites

1. Take and verify a fresh encrypted production backup.
2. Review the PostgreSQL `prisma db push` diff; it must only add the approved columns, tables, relations, and indexes.
3. Confirm the full production inventory still totals 17 batches, 150 reports, and 109 Copy Lab links; all 17 legacy batches must remain `AGGREGATE_SNAPSHOT`, ineligible, and free of invented stable IDs or daily observations. Confirm the Mahoraga subset remains 5 batches, 50 reports, and 18 Copy Lab links.
4. Run the reviewed PostgreSQL companion for checks, RLS, and direct-role revocation.
5. Configure distinct `ads-preview` and `ads-raw` private namespaces plus 30-day raw retention.
6. Validate/generate both Prisma schemas and rerun deterministic plus disposable-PostgreSQL suites.
7. Deploy code without importing data; verify TOTP, preview, final review, idempotency, cleanup dry-run, logs, and backup restore.
8. Only in a separately approved gate, upload a reviewed DAILY Meta bundle and observe it before campaign linking.
9. Only after a stable-ID link is explicitly confirmed may Mahoraga campaign onboarding resume. Do not infer historical intervals from the five aggregate snapshots.
