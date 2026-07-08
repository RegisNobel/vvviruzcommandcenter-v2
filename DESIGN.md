# vvviruz Command Center Design Direction

_Last updated: 2026-07-08_

## Design Thesis

The Command Center should feel like a premium underground artist operations console: tactical, music-first, cyberpunk-coded, and calm enough to use every day.

It should not feel like a generic SaaS dashboard, a noisy game HUD, or a pile of dark cards. The strongest direction is **black-glass command hardware with gold signal language**: deep charcoal surfaces, disciplined spacing, strong hierarchy, subtle scanline/grid texture, and color used only when it tells the operator what matters.

Public surfaces can be more cinematic. Admin surfaces should be sharper, denser, and calmer.

## Reference Sites And What To Steal

| Reference | What Fits vvviruz | What Not To Copy Blindly |
| --- | --- | --- |
| Cyberpunk 2077 universe site | Black/yellow urgency, diagonal signal language, all-caps labels, content modules that feel like dispatches. | Do not overdo glitch/noise or make admin screens feel like a video game. |
| Linear | Calm decision surfaces, high-density product UI, clear hierarchy, quiet premium dashboard feel. | Do not become sterile or too corporate. vvviruz still needs grime and attitude. |
| Vercel | Crisp black/white system design, confident spacing, product/ops clarity, clean technical framing. | Do not drift into plain developer-tool minimalism. |
| teenage engineering | Product-object minimalism, small technical labels, playful-but-precise audio hardware energy. | Do not sacrifice readability for weirdness. |
| Nothing | Tech-lifestyle restraint, concise copy, monochrome hardware language, modular product cards. | Do not make everything too white/consumer-electronics clean. |
| Panic | Human personality, clear product groupings, direct copy, playful confidence. | Do not make the Command Center whimsical; keep it controlled. |

## Core Principles

1. **Signal over decoration**
   Gold, glow, borders, and motion should mean something: primary action, active state, warning, current winner, live campaign, or publish readiness.

2. **One primary decision per screen**
   Each admin page should answer one main operator question first. Supporting data can exist, but should be secondary, collapsed, or visually quieter.

3. **Command surfaces, not card piles**
   Replace repeated isolated cards with larger structured panels, rails, dashboards, and split panes. Cards are useful for records and summaries, but too many rounded boxes makes the app feel fragmented.

4. **Music-first, not spreadsheet-first**
   Even analytics screens should keep the artist workflow visible: release, creative, hook, visual, result, next test. Metrics support the decision; they are not the whole story.

5. **Public pages can breathe; admin pages should scan**
   Public site: cinematic, editorial, immersive. Admin: compact, fast, keyboard/desktop-friendly, with mobile good enough for quick checks.

6. **Status language must be actionable**
   Avoid labels that sound broken when the system is simply waiting for data. Prefer: `Awaiting Meta CSV`, `First-party tracking`, `Directional only`, `Needs more data`.

## Visual System

### Color Tokens

Use these as the next shared token layer. Existing colors are close, but they should be centralized so pages stop hand-rolling near-identical hex values.

```css
:root {
  --cc-bg: #07090d;
  --cc-bg-2: #0b0e13;
  --cc-panel: #11151b;
  --cc-panel-2: #171c24;
  --cc-panel-3: #1d232d;
  --cc-border: rgba(132, 143, 158, 0.22);
  --cc-border-strong: rgba(215, 180, 94, 0.42);
  --cc-text: #f1eadc;
  --cc-muted: #8f98a5;
  --cc-faint: #59616d;
  --cc-gold: #d7b45e;
  --cc-gold-hot: #f2c85b;
  --cc-blue: #8cb4f5;
  --cc-green: #31d98b;
  --cc-red: #ff5c73;
  --cc-purple: #b993ff;
}
```

### Color Usage

- Gold: primary CTAs, current active section, winning/important signal, public brand accent.
- Blue: tracking, attribution, data-linked state, external platform context.
- Green: healthy/ready/complete.
- Amber: caution, low-confidence-but-promising, needs review.
- Red: blocker, destructive action, real error only.
- Purple: rare. Use only for community/experimental/lab flavor, not as the default accent.

### Typography

Recommended direction:

- Display/headings: `Space Grotesk` or `Sora`.
- Technical labels/data: `IBM Plex Mono` or `Space Mono`.
- Body/UI: `Space Grotesk`, `Satoshi`, or current fallback until a font pass is scheduled.

Rules:

- Section eyebrows stay uppercase, tracked, small.
- Main page titles should be heavier and tighter.
- Tables need stronger numeric alignment and less all-caps noise.
- Body copy should be calmer and less dense on public pages.

### Surfaces

Preferred surface ladder:

1. Page background: near-black gradient with faint gold/gray atmospheric light.
2. Primary panel: large rounded command surface with subtle border.
3. Secondary rail: darker, flatter, less glow.
4. Cards: only for records, states, or choices.
5. Debug drawers: collapsed, quiet, dense.

Avoid nested `card inside card inside card` unless the nesting communicates hierarchy.

### Borders And Glow

- Default border: cool gray, low opacity.
- Active border: gold with a soft inner glow.
- Hover glow: subtle and local, never page-wide.
- Use glow on public CTAs and active admin states, not every panel.

### Motion

Use motion sparingly:

- Page entry: tiny fade/translate for public hero sections.
- Hover: 1-2px lift on public cards and active workflow cards.
- Admin: avoid decorative motion except focus, active, loading, and confirmation states.

## Layout Patterns

### Admin Page Pattern

1. Command header
   - Page label
   - Main title
   - One-line purpose
   - One primary action

2. Operator summary
   - 3-5 decisive metrics or statuses only

3. Main work surface
   - Table, editor, timeline, or dashboard

4. Secondary diagnostics
   - Collapsed by default

5. Sticky/dock actions
   - Only where saving/editing is active

### Public Page Pattern

1. Cinematic hero
2. Clear primary CTA
3. Release/music context
4. Proof or related exploration
5. Secondary CTA

Public pages should use larger art, fewer boxes, and more narrative spacing.

## Component Upgrade Targets

### Buttons

Define shared variants:

- `primary`: gold fill, black text.
- `secondary`: dark fill, gray border.
- `ghost`: transparent, muted, hover surface.
- `danger`: red-toned border/fill.
- `platform`: Spotify/Apple/YouTube-specific, used public-facing only.

### Pills / Badges

Standardize by meaning:

- `status-ready`
- `status-warning`
- `status-blocked`
- `status-tracking`
- `status-archived`
- `status-live`
- `status-draft`

### Tables

Tables need a visual pass more than almost anything else.

- Sticky table headers where useful.
- Zebra rows should be extremely subtle.
- Numeric columns right-aligned.
- Long IDs should become badges, abbreviations, or expandable details.
- Debug columns should move into drawers.

### Empty States

Every empty state should answer:

- What is missing?
- Why does it matter?
- What should I do next?

No dead empty boxes.

## Page-Level Direction

### Release Detail

Goal: release operating system.

Design direction:

- Left side: editor/workflow.
- Right side: compact command rail with Internal Progress, Public Publish Ready, Discovery Quality, Short Links, Campaign Memory.
- Strategic Intelligence should feel like a tactical readout, not another analytics dump.

### Ad Lab

Goal: import, validate, diagnose latest Meta snapshot.

Design direction:

- Batch Action at top.
- Creative Leaderboard as the main surface.
- Diagnostics in drawers.
- Confidence language must stay cautious.

### Attribution

Goal: funnel truth.

Design direction:

- Funnel first.
- Quality/tracking second.
- Matrix third.
- Raw analytics hidden unless needed.

### Copy Lab

Goal: reusable creative library.

Design direction:

- More library-like, less list-like.
- Grouping controls should feel like segmented view modes.
- Variant rows should read as one idea with multiple executions.

### Short Links

Goal: fast campaign link creation.

Design direction:

- Builder on top with live preview.
- Lifecycle status must be obvious.
- Management table should be quieter and more compact.

### Public Site

Goal: premium artist hub.

Design direction:

- Less generic card stacking.
- More release art, story, and music context.
- Stronger editorial sections.
- Gold accent should feel like brand signal, not a button color only.

### Exclusives

Goal: fan-facing early-access conversion.

Design direction:

- Keep `Exclusives` as public nav label.
- Internally, copy can say Early Access / Insider Preview.
- Avoid splitting vocabulary too much for visitors.
- Preview art/upload states should feel premium and direct.

## Implementation Strategy

### Phase 1: Foundation

- Add shared design tokens to `app/globals.css`.
- Create or consolidate shared primitives for panels, buttons, pills, status badges, page headers, and table wrappers.
- Do not redesign every page yet.

### Phase 2: Highest-Impact Admin Screens

1. Release Detail
2. Ad Lab Batch Detail
3. Attribution
4. Copy Lab
5. Short Links

### Phase 3: Public Site Polish

1. Homepage
2. Music library
3. Release detail pages
4. Links hubs
5. Exclusives
6. Vault

## Guardrails

Do not:

- Turn the app purple by default.
- Add heavy animation to admin pages.
- Use glow everywhere.
- Make every section a rounded card.
- Hide primary actions in clever UI.
- Make public copy sound like SaaS onboarding.
- Make analytics screens look like spreadsheets with a coat of paint.

Do:

- Centralize visual tokens.
- Make status colors mean consistent things.
- Use fewer, stronger panels.
- Keep gold as the vvviruz command signal.
- Preserve desktop operator speed.
- Keep mobile usable for quick checks.

## North Star

The redesigned Command Center should feel like the place an artist goes to control the release machine: plan the drop, ship the page, launch the ads, read the signal, archive the lesson, and move to the next test without fighting the interface.
