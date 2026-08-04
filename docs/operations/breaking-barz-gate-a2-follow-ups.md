# Breaking Barz Gate A2 follow-ups

These items are intentionally outside Gate A2 and remain tracked after the six-table production hardening.

## Production admin authentication

Gate A2 initially reported an 11-character production `AUTH_SECRET`; Gate A3 established that the observed 11-character text was Vercel's `[Sensitive]` pull placeholder, not the underlying value. Gate A3 still rotated the variable to a reviewed 32-random-byte, 43-character base64url secret, invalidated existing sessions, and required controlled TOTP re-enrollment. Future checks must use Vercel's sensitive-variable metadata plus the recorded generation method and must not treat pulled placeholders as secret measurements.

## Submitter contact retention

Optional submitter name and email may continue to be collected. A separate reviewed retention implementation should remove contact data from rejected submissions after 90 days without deleting the non-contact moderation record.

## Broad PostgreSQL default ACL

New tables in the public schema currently risk inheriting broad grants for `anon`, `authenticated`, and `service_role`. A future infrastructure gate must revoke unsafe PostgreSQL default privileges. Until that is complete, every deployment that creates a table must explicitly inspect its table ACL, RLS enabled/forced state, owner, and policies.

## Product filter terminology

The public Breaking Barz surface provides artist, song, and category selectors plus pagination. It does not currently provide a free-text search field or a separate release selector; release-scoped filtering exists only in the repository API. Decide whether the product requirement calls for exposing those controls in a separate feature change.
