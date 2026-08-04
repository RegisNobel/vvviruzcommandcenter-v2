# Retention Lab chart library decision

Date: 2026-08-03
Stage: 9 — Chart Library Decision
Decision: use Recharts 3.10.1 with `react-is` 19.1.0

## Scope and decision boundary

This decision covers visualization of server-provided Stage 7 retention results and confirmed Stage 6 campaign timeline data. It does not authorize a production dashboard, production charts, new analytics formulas, source-of-stream attribution, paid-dependency scoring, multi-track album analysis, schema changes, or deployment.

The retained proof is an unlinked, protected, synthetic route at `/admin/retention-lab/chart-poc`. Recharts is loaded only inside a dynamically imported client island. The page and fixture remain server-side.

## Requirements exercised

The shared 210-day representative data shape includes four explicit missing artist dates, three missing track dates, a primary release, two confirmed campaign intervals separated by a pause, budget/creative/audience/organic events, one overlapping release, baseline/campaign/post-campaign windows, an excluded floor, one-day and seven-day peaks, daily artist listeners, a server-provided seven-day listener average, rolling monthly metrics, and a separate track-stream series.

The same fixture generator supports 180, 365, and 1,000 days. Dates are UTC-safe `YYYY-MM-DD` strings. The chart receives all values, gaps, windows, statuses, confidence, reasons, provenance, and marker locations; it does not calculate or infer them.

## Candidate comparison

Scores are 1–5. The weighted total uses functional fit 30%, accessibility 20%, developer experience 20%, performance 20%, and product fit 10%.

| Candidate | Functional | Accessibility | Developer experience | Performance | Product fit | Weighted |
|---|---:|---:|---:|---:|---:|---:|
| Recharts | 5.0 | 4.0 | 4.5 | 3.5 | 5.0 | **4.40** |
| Visx | 4.5 | 2.5 | 2.5 | 4.0 | 4.5 | 3.60 |
| Apache ECharts | 5.0 | 3.0 | 3.0 | 2.5 | 3.5 | 3.55 |
| Custom SVG | 4.0 | 2.0 | 1.5 | 5.0 | 4.0 | 3.30 |

Before installing a dependency, each serious candidate was mapped against the same chart contract in an isolated API-level spike:

- Recharts directly expresses segmented null-valued lines, interval bands, date markers, multiple axes, responsive SVG, and controlled tooltips. Its `Line` API defaults `connectNulls` to false, and the proof sets it explicitly. `ReferenceArea` and `ReferenceLine` cover the required windows and events without chart-owned business logic. [Recharts Line API](https://recharts.github.io/en-US/api/Line/) and [Recharts repository](https://github.com/recharts/recharts)
- Visx can express every visual, but the spike required custom scales, axis layout, missing-value segmentation, responsive measurement, tooltip state/hit testing, keyboard focus, and screen-reader structure. Visx describes itself as low-level and unopinionated and expects teams to build their own chart library; that flexibility does not repay the maintenance burden here. [Visx repository](https://github.com/airbnb/visx)
- ECharts has strong `markArea`, `markLine`, zoom, and high-volume rendering, but requires an imperative client lifecycle or a community React wrapper. Its ARIA support must be imported and enabled, and Command Center styling/accessible companion behavior still needs application glue. The official modular imports help tree shaking, but the runtime is larger and broader than this scope needs. [ECharts import guide](https://echarts.apache.org/handbook/en/basics/import/) and [ECharts ARIA guide](https://echarts.apache.org/handbook/en/best-practices/aria/)
- Custom SVG avoids a dependency but becomes an application-owned charting library once scales, ticks, resizing, hit testing, marker collision, keyboard inspection, accessible descriptions, printing, and regression tests are included.

Per the dependency gate, Visx and ECharts were not installed or retained after the documented comparison. Only the leading candidate received a compiled browser proof.

## Why Recharts wins

Recharts is the smallest maintenance decision, not the smallest downloaded artifact. It represents honest gaps and multiple disjoint intervals directly, uses React components and TypeScript without an adapter wrapper, accepts existing Command Center tokens, and leaves confidence/provenance in surrounding application UI. The proof required no date, global-state, animation, or tooltip package.

React 19 is supported by Recharts 3.10.1. Recharts asks React users to install a matching `react-is`, so the selected direct dependencies are:

```text
recharts@3.10.1
react-is@19.1.0
```

## Bundle and runtime observations

The optimized Next.js build reports:

- Shared first-load JS: 103 kB.
- Proof route first-load JS: 104 kB, including a 1.4 kB route entry.
- Deferred chart chunk: 393,172 raw bytes; 113,458 gzip bytes; 92,380 Brotli bytes.
- Route entry on disk: 3,725 raw bytes; 1,404 gzip bytes; 1,254 Brotli bytes.

The dynamic client island keeps the chart dependency out of the shared bundle and unrelated routes. The deferred chunk is still material and must remain route-scoped.

One local production-build Chromium run observed navigation plus visible-chart render at 455 ms for 180 points, 460 ms for 365 points, and 531 ms for 1,000 points. A keyboard inspector update was observed at 24 ms. These are smoke observations on the local machine, not cross-device benchmarks.

## Chart data adapter

`RetentionChartPayload` is a safe, versioned server-to-client DTO. It contains:

- date-only series points and nullable server-provided measures;
- explicit missing-data flags and server-assigned window tags;
- analysis windows with status, confidence, reason codes, and provenance;
- confirmed campaign intervals;
- release, campaign lifecycle, change, organic, and peak markers;
- calculation version/cutoff/status/confidence/reasons/interpretation/provenance metadata;
- safe series descriptions and an accessible summary.

It deliberately excludes raw Prisma records, import storage keys, file hashes, source rows, and original values. Stage 8 should construct this DTO on the server from existing Stage 6/7 outputs. It must not make the chart infer gaps, merge intervals, resolve mappings, determine confidence, or recalculate metrics.

The current Stage 7 contract has one confidence field. The proposed input-confidence/attribution-confidence split should be shaped by the server/API in Stage 8 if added; the chart must not derive it.

## Client and SSR boundary

The protected page is a Server Component. It creates the safe payload and passes it to a small client loader. The loader dynamically imports the Recharts island with `ssr: false`; no unrelated page section becomes client-rendered. The focused browser test found no hydration mismatch or uncaught client error.

This means the plot itself is unavailable before JavaScript loads. The loading state is announced, and the eventual production page must keep critical status and summaries server-rendered outside the plot.

## Accessibility strategy

The chart is an enhancement, never the only representation of the result:

- a labeled summary explains the campaign intervals, gaps, exclusion, and interpretation;
- windows and events are available as semantic lists;
- all dates and safe values are available in an inspectable table;
- a native range input provides keyboard-accessible, non-hover date inspection;
- solid/dashed/thick/thin encodings and text labels supplement color;
- Recharts' accessibility layer is enabled, while the companion UI remains the dependable screen-reader path;
- animation is disabled, so reduced-motion users receive no animated series or tooltip transitions;
- responsive and print styles keep charts legible and hide the interactive-only inspector when printed.

Recharts' built-in accessibility layer supports keyboard navigation, but SVG tooltips are not sufficient as the sole accessible experience. [Recharts accessibility notes](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility)

## Testing strategy

Keep deterministic contract tests for payload safety and gap semantics. Keep focused production-build browser tests for SVG gap segmentation, all window bands, pause separation, markers, private-field absence, keyboard inspection, non-color alternatives, mobile overflow, print, reduced motion, hydration, and the 180/365/1,000-point matrix. Stage 8 should add visual-regression coverage if marker density or layout becomes more complex.

## Known limitations and mitigations

- **Tooltip accessibility:** pointer-driven chart tooltips are supplemental. Use the native keyboard inspector, semantic lists, summary, and data table.
- **Bundle size:** the 113,458-byte gzip deferred chunk is significant. Keep it dynamically route-scoped; do not move Recharts into shared layouts or navigation.
- **Dense markers:** labels can collide in narrow or long ranges. Label only high-priority markers in the plot and put the complete timeline in the event list; Stage 8 may add server-selected ranges.
- **Large date ranges:** 1,000 points pass the smoke budget, but low-end mobile hardware has not been benchmarked. Avoid dots and animation, preserve linear paths, and add a date-range selector rather than client aggregation if production data grows materially.
- **Client-only rendering:** the SVG depends on JavaScript. Keep critical interpretation outside the client island and retain the accessible non-chart representation.
- **High contrast:** non-color encodings and labels are present, but Windows forced-colors mode was not separately automated.
- **Dependency advisories:** `npm audit` currently reports five existing dependency-tree findings (one low, four high) through `tsx/esbuild`, ESLint tooling, and `next` dependencies (`postcss`/`sharp`). No finding traces through Recharts. Remediation would require work outside Stage 9, including a major Next.js upgrade for the reported Next path.

## Stage boundary

No database schema or data changed. No production system was contacted. No production route, dashboard, metric card, release panel, formula, campaign chart, source-of-stream feature, paid-dependency score, multi-track support, or deployment was added.

## Files

Created:

- `app/admin/(protected)/retention-lab/chart-poc/page.tsx`
- `components/stage9-recharts-proof-loader.tsx`
- `components/stage9-recharts-proof-of-concept.module.css`
- `components/stage9-recharts-proof-of-concept.tsx`
- `docs/retention-chart-library-decision.md`
- `lib/analytics/retention-chart-contract.ts`
- `lib/analytics/retention-chart-poc-fixture.ts`
- `scripts/test-retention-chart-contract.ts`
- `tests/stage9-chart-poc.spec.ts`

Modified:

- `package.json`
- `package-lock.json`

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed; the existing warning that the Next.js ESLint plugin is not detected remains.
- `npm run test:retention-chart-contract` — passed.
- `npm run test:stage9-chart-poc` — 6/6 passed.
- `npm run test:retention-calculations` — passed.
- `npm run test:retention-data` — passed.
- `npm run test:retention-api` — passed.
- `npx playwright test` — 17/19 passed. All Stage 9 and Retention Lab browser tests passed. The two known unrelated failures remain: the Insider Access heading expectation and the release-cover fixed-width expectation.
- `npm audit --json` — completed with the five findings described above; no Recharts path was reported.

## Completion criteria

- Existing dependency, bundle, client/server, design-token, accessibility, Stage 6, and Stage 7 surfaces inspected — passed.
- Recharts, Visx, and Apache ECharts evaluated against one contract and scored — passed.
- Representative 180+ day data includes honest gaps, two intervals and pause, releases, all requested windows, track data, events, peaks, and exclusion — passed.
- Selected dependency is isolated to a client-only proof and does not infect shared or server boundaries — passed.
- Chart consumes supplied values and metadata without formula, gap, interval, mapping, confidence, or causality decisions — passed.
- Responsive, mobile, keyboard, non-color, reduced-motion, print, hydration, privacy, and 180/365/1,000-point checks — passed.
- Companion summary, lists, inspector, and table prevent chart-only disclosure — passed.
- Stage 7 deterministic and API regressions — passed.
- No Stage 8 product work, database change, production contact, or deployment — passed.

Verdict: **Complete with limitations**. The limitations are the material deferred bundle, client-only plot rendering, marker-density risk, absent low-end-device/forced-colors benchmarks, current dependency advisories outside the Recharts path, and two unchanged unrelated browser failures.
