# Known unrelated browser failures

These failures predate and are outside Audience Retention Lab. They must remain visible in the full-suite report rather than being normalized to green.

| Test | Current expectation | Current actual | Retention Lab relation | Follow-up |
| --- | --- | --- | --- | --- |
| `verify locked exclusives page privacy, signup flow, and unlocking` | `<h1>` matches `Insider Access` or `Join Insider Access`. | `<h1>` is `Exclusive Track`. | The route, component, data, and failure do not touch Retention Lab. | Public-site/Insider Access owner should decide whether product copy or test authority wins. |
| `measure and verify release cover artwork dimensions` | Desktop cover width rounds to 542 px. | Desktop cover width rounds to 487 px. | The public release cover component is independent of analytics routes and dashboard styles. | Public release visual-regression owner should re-baseline or correct the layout in a separate task. |
