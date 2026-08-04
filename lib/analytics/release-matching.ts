import {createHash} from "node:crypto";

import {parseSpotifyReleaseUrl} from "@/lib/spotify-links";

export const MAPPING_CONFIDENCE_LEVELS = [
  "EXACT_ID",
  "EXACT_ALIAS",
  "EXACT_TITLE_DATE",
  "EXACT_TITLE_UNIQUE",
  "FUZZY_HIGH",
  "FUZZY_LOW",
  "AMBIGUOUS",
  "NO_MATCH"
] as const;

export type MappingConfidence = (typeof MAPPING_CONFIDENCE_LEVELS)[number];

export type MappingEvidenceInput = {
  exportedTitle: string;
  exportedReleaseDate?: string | null;
  spotifyTrackId?: string | null;
  isrc?: string | null;
  spotifyUrl?: string | null;
  upc?: string | null;
};

export type MappingCandidate = {
  id: string;
  title: string;
  releaseDate: Date | null;
  primaryArtistProfileId: string | null;
  spotifyUrl: string;
  isrc: string;
  upc: string;
};

export type MappingAliasCandidate = {
  id: string;
  scopeKey: string;
  status: string;
  releaseId: string;
};

export type MappingSuggestion = {
  candidateReleaseId: string | null;
  matchMethod: string;
  confidence: MappingConfidence;
  evidence: Record<string, unknown>;
  competingCandidates: Array<{releaseId: string; title: string; score?: number}>;
  manualConfirmationRequired: boolean;
  mayAutoApply: boolean;
  aliasId: string | null;
};

export function normalizeMappingTitle(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function buildReleaseAliasScope(input: {
  artistProfileId: string;
  source: string;
  exportType: string;
  exportedTitle: string;
  exportedReleaseDate?: string | Date | null;
}) {
  const canonical = [
    input.artistProfileId.trim(),
    input.source.trim().toUpperCase(),
    input.exportType.trim().toUpperCase(),
    normalizeMappingTitle(input.exportedTitle),
    dateKey(input.exportedReleaseDate) || "NO_DATE"
  ].join("\u001f");
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildConfirmedMappingScope(importId: string, releaseId: string) {
  return createHash("sha256").update(`${importId}\u001f${releaseId}`).digest("hex");
}

function spotifyTrackId(url: string) {
  if (!url.trim()) return null;
  try {
    const parsed = parseSpotifyReleaseUrl(url);
    return parsed.type === "track" ? parsed.id : null;
  } catch {
    return null;
  }
}

function uniqueMatch(
  matches: MappingCandidate[],
  method: string,
  confidence: MappingConfidence,
  evidence: Record<string, unknown>,
  auto: boolean
): MappingSuggestion | null {
  if (!matches.length) return null;
  if (matches.length > 1) {
    return {
      candidateReleaseId: null,
      matchMethod: method,
      confidence: "AMBIGUOUS",
      evidence: {...evidence, candidateCount: matches.length},
      competingCandidates: matches.map(({id, title}) => ({releaseId: id, title})),
      manualConfirmationRequired: true,
      mayAutoApply: false,
      aliasId: null
    };
  }
  return {
    candidateReleaseId: matches[0].id,
    matchMethod: method,
    confidence,
    evidence,
    competingCandidates: [],
    manualConfirmationRequired: !auto,
    mayAutoApply: auto,
    aliasId: null
  };
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({length: right.length + 1}, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

function similarity(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  return length ? 1 - levenshtein(left, right) / length : 1;
}

function secondarySuggestionTitle(value: string) {
  return value.replace(/\s+\([^()]*(?:rap|soundtrack|theme|version)\)\s*$/i, "").trim();
}

export function suggestReleaseMapping(input: {
  artistProfileId: string;
  source: string;
  exportType: string;
  evidence: MappingEvidenceInput;
  candidates: MappingCandidate[];
  aliases?: MappingAliasCandidate[];
}): MappingSuggestion {
  const candidates = input.candidates.filter(({primaryArtistProfileId}) => primaryArtistProfileId === input.artistProfileId);
  const incompatibleCandidateCount = input.candidates.length - candidates.length;
  const normalizedTitle = normalizeMappingTitle(input.evidence.exportedTitle);
  const releaseDate = dateKey(input.evidence.exportedReleaseDate);
  const trackId = input.evidence.spotifyTrackId?.trim();
  if (trackId) {
    const result = uniqueMatch(candidates.filter((candidate) => spotifyTrackId(candidate.spotifyUrl) === trackId), "SPOTIFY_TRACK_ID", "EXACT_ID", {spotifyTrackId: trackId, incompatibleCandidateCount}, true);
    if (result) return result;
  }
  const isrc = input.evidence.isrc?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (isrc) {
    const result = uniqueMatch(candidates.filter((candidate) => candidate.isrc.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === isrc), "ISRC", "EXACT_ID", {isrc, incompatibleCandidateCount}, true);
    if (result) return result;
  }
  const urlTrackId = input.evidence.spotifyUrl ? spotifyTrackId(input.evidence.spotifyUrl) : null;
  if (urlTrackId) {
    const result = uniqueMatch(candidates.filter((candidate) => spotifyTrackId(candidate.spotifyUrl) === urlTrackId), "SPOTIFY_URL_TRACK_ID", "EXACT_ID", {spotifyTrackId: urlTrackId, incompatibleCandidateCount}, true);
    if (result) return result;
  }
  const upc = input.evidence.upc?.replace(/\D/g, "");
  if (upc) {
    const matches = candidates.filter((candidate) => candidate.upc.replace(/\D/g, "") === upc).filter((candidate) => !releaseDate || !candidate.releaseDate || dateKey(candidate.releaseDate) === releaseDate);
    const result = uniqueMatch(matches, "UPC_RELEASE_CONTEXT", "EXACT_ID", {upc, releaseDate: releaseDate || null, incompatibleCandidateCount}, true);
    if (result) return result;
  }
  const scopeKey = buildReleaseAliasScope({artistProfileId: input.artistProfileId, source: input.source, exportType: input.exportType, exportedTitle: input.evidence.exportedTitle, exportedReleaseDate: input.evidence.exportedReleaseDate});
  const aliases = (input.aliases ?? []).filter((alias) => alias.status === "ACTIVE" && alias.scopeKey === scopeKey);
  if (aliases.length) {
    const distinctReleaseIds = [...new Set(aliases.map(({releaseId}) => releaseId))];
    if (distinctReleaseIds.length === 1 && candidates.some(({id}) => id === distinctReleaseIds[0])) {
      return {candidateReleaseId: distinctReleaseIds[0], matchMethod: "CONFIRMED_ALIAS", confidence: "EXACT_ALIAS", evidence: {scopeKey, aliasId: aliases[0].id}, competingCandidates: [], manualConfirmationRequired: false, mayAutoApply: true, aliasId: aliases[0].id};
    }
    return {candidateReleaseId: null, matchMethod: "CONFIRMED_ALIAS", confidence: "AMBIGUOUS", evidence: {scopeKey, aliasIds: aliases.map(({id}) => id)}, competingCandidates: distinctReleaseIds.map((releaseId) => ({releaseId, title: candidates.find(({id}) => id === releaseId)?.title ?? "Unavailable release"})), manualConfirmationRequired: true, mayAutoApply: false, aliasId: null};
  }
  const exactTitle = candidates.filter((candidate) => normalizeMappingTitle(candidate.title) === normalizedTitle);
  if (releaseDate) {
    const result = uniqueMatch(exactTitle.filter((candidate) => dateKey(candidate.releaseDate) === releaseDate), "EXACT_TITLE_DATE", "EXACT_TITLE_DATE", {normalizedTitle, releaseDate}, false);
    if (result) return result;
  }
  const exact = uniqueMatch(exactTitle, "EXACT_TITLE_UNIQUE", "EXACT_TITLE_UNIQUE", {normalizedTitle, releaseDate: releaseDate || null}, false);
  if (exact) return exact;

  const secondaryTitle = secondarySuggestionTitle(normalizedTitle);
  const ranked = candidates
    .map((candidate) => {
      const candidateTitle = normalizeMappingTitle(candidate.title);
      const score = Math.max(similarity(normalizedTitle, candidateTitle), similarity(secondaryTitle, secondarySuggestionTitle(candidateTitle)) * 0.96);
      return {candidate, score};
    })
    .filter(({score}) => score >= 0.55)
    .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id));
  if (ranked.length) {
    const top = ranked[0];
    const ambiguous = ranked[1] && Math.abs(top.score - ranked[1].score) < 0.03;
    return {
      candidateReleaseId: ambiguous ? null : top.candidate.id,
      matchMethod: "FUZZY_TITLE_SUGGESTION",
      confidence: ambiguous ? "AMBIGUOUS" : top.score >= 0.8 ? "FUZZY_HIGH" : "FUZZY_LOW",
      evidence: {normalizedTitle, secondaryTitle: secondaryTitle === normalizedTitle ? null : secondaryTitle, score: Number(top.score.toFixed(4)), incompatibleCandidateCount},
      competingCandidates: ranked.slice(ambiguous ? 0 : 1, 6).map(({candidate, score}) => ({releaseId: candidate.id, title: candidate.title, score: Number(score.toFixed(4))})),
      manualConfirmationRequired: true,
      mayAutoApply: false,
      aliasId: null
    };
  }
  return {candidateReleaseId: null, matchMethod: "NO_MATCH", confidence: "NO_MATCH", evidence: {normalizedTitle, releaseDate: releaseDate || null, incompatibleCandidateCount}, competingCandidates: [], manualConfirmationRequired: true, mayAutoApply: false, aliasId: null};
}
