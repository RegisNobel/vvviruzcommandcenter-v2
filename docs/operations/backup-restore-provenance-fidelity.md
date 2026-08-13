# Backup Restore Provenance Fidelity

## Policy

Complete snapshots preserve administrator provenance. Restore code keeps each nullable admin foreign key when that `AdminUser` exists in the target. If an older or incomplete snapshot references an absent administrator, the restore leaves that field null and emits `MISSING_ADMIN_ACTOR_REFERENCE` with only the model, record index, and field name. It never invents or remaps an actor.

The protected disposable verification job imports `AdminUser` rows before dependent records (`IMPORT_AUTH=1`). The interactive application restore continues to skip administrator records for security; it preserves references only to administrators already present in that target.

## Mutation audit

| Restore transformation | Classification | Behavior |
| --- | --- | --- |
| `AnalyticsImport.uploadedById`, `withdrawnById` forced null | `UNNECESSARY_FIDELITY_LOSS` | Removed; preserve when referenced admin exists, warn/null only when absent. |
| Actor fields on mappings, Meta imports/links, campaigns, evidence, intervals, and audit events forced null | `UNNECESSARY_FIDELITY_LOSS` | Removed under the same compatibility policy. |
| Interactive restore skips snapshot `AdminUser` rows | `SECURITY_REDACTION` | Retained to avoid overwriting live authentication state. |
| CLI restore skips `AdminUser` unless `IMPORT_AUTH=1` | `SECURITY_REDACTION` | Retained; protected disposable verification explicitly opts in. |
| `AnalyticsImport.replacedByImportId` temporary null | `REQUIRED_SELF_REFERENCE_BOOTSTRAP` | Retained, then restored in a second pass. |
| Alias, Ad batch, Meta-link, timezone, evidence, interval, and event supersession fields temporary null | `REQUIRED_SELF_REFERENCE_BOOTSTRAP` | Retained, then restored in a second pass. |
| Artist published-version and Breaking Barz current-version fields temporary null | `REQUIRED_SELF_REFERENCE_BOOTSTRAP` | Retained, then restored after dependent versions exist. |
| Date strings hydrated to `Date` | `OTHER` | Required Prisma representation conversion; values remain equivalent. |
| Immutable audit/observation rows already present in target are not rewritten | `BACKWARD_COMPATIBILITY` | Retained for idempotent recovery. |
| Backup-run records are restored without field normalization | `OTHER` | No fidelity-changing transformation. |

Git history shows actor nulling arrived with the Audience Retention Lab deployment package (`0b8cb7d`). The only recoverable rationale is the adjacent security policy that skips administrator restoration plus foreign-key ordering. No test or comment documented actor erasure as a desired audit policy.

## Verification contract

The Game Over verifier retains the frozen import, provenance, and timeline fingerprints. Assertions now use safe field-specific codes and never print unexpected restored values. The pinned encrypted backup is not modified by this repair.
