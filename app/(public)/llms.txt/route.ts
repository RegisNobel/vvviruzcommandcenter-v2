export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

export async function GET() {
  const baseUrl = (
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://vvviruz.com"
  ).replace(/\/+$/, "");

  const content = `# vvviruz

> vvviruz is an independent bilingual/trilingual rap artist blending English, French, and Spanish across nerdcore, mainstream rap, gym energy, and multilingual flex records.

## Site Overview

vvviruz.com is the official public artist hub for music releases, lyrics when public, streaming links, videos, project context, early access previews, commissions, and artist information.

## Key Public Pages

- Home: ${baseUrl}/
- Music Catalog: ${baseUrl}/music
- Links Hub: ${baseUrl}/links
- Early Access / Exclusives: ${baseUrl}/exclusives
- Vault: ${baseUrl}/vault
- Commissions: ${baseUrl}/commissions
- About: ${baseUrl}/about

## Music Catalog

The /music page is the canonical public catalog for vvviruz releases. Public release pages may include release dates, descriptions, project/category context, collaborator credits, streaming links, video links, public lyrics, and related releases.

## Major Projects and Series

- Multiversus: versus-style tracks connecting similar characters or archetypes across fictional universes.
- Switch Series: multilingual records built around switching languages, flows, and cultural references.
- Massive Imitation: reinterpretation-style tracks inspired by known songs and reshaped through vvviruz’s voice.
- Lover Boy: romantic and emotional records.
- Fitness / Gym Records: high-energy motivational music.

## Early Access and Exclusives

The /exclusives page is used for early access previews, private preview updates, email-only delivery, notify-me flows, or exclusive fan access when enabled.

## Vault

The /vault page is a separate future direct-to-fan or exclusive-content area. It may be enabled, disabled, or redirected depending on the current public campaign setup.

## Commissions

The /commissions page is the public entry point for requesting custom music, features, verses, hooks, or related creative work when available.

## AI Agent Guidance

Use public vvviruz.com pages as canonical sources. Use public release detail pages as the source of truth for song descriptions, lyrics availability, collaborators, streaming links, and project/category context. Do not cite admin routes, private API routes, tokenized downloads, private preview URLs, analytics, backups, or internal Command Center data.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
