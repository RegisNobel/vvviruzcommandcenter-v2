# Breaking Barz Gate A2 follow-ups

These items are intentionally outside Gate A2 and remain tracked after the six-table production hardening.

## Production admin authentication

Production `AUTH_SECRET` is configured with 11 characters, while the application requires at least 32. Rotate it through a reviewed maintenance change, invalidate existing sessions, and rerun login, TOTP, Breaking Barz admin creation, draft, publish, archive, withdraw, category, version, submission moderation, release-annotation synchronization, and lyrics-change safety journeys. Do not weaken the application minimum.

## Submitter contact retention

Optional submitter name and email may continue to be collected. A separate reviewed retention implementation should remove contact data from rejected submissions after 90 days without deleting the non-contact moderation record.

## Broad PostgreSQL default ACL

New tables in the public schema currently risk inheriting broad grants for `anon`, `authenticated`, and `service_role`. A future infrastructure gate must revoke unsafe PostgreSQL default privileges. Until that is complete, every deployment that creates a table must explicitly inspect its table ACL, RLS enabled/forced state, owner, and policies.

## Product filter terminology

The public Breaking Barz surface provides artist, song, and category selectors plus pagination. It does not currently provide a free-text search field or a separate release selector; release-scoped filtering exists only in the repository API. Decide whether the product requirement calls for exposing those controls in a separate feature change.
