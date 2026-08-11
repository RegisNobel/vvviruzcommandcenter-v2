import "server-only";

import {createHash} from "node:crypto";
import {Prisma} from "@prisma/client";

import {prisma} from "@/lib/db/prisma";
import type {AdminErrorCode} from "@/lib/admin-errors";
import {metaPromotionScopeWhere, selectMostSpecificMetaPromotionLinks} from "@/lib/ads/meta-promotion-links";
import {AdminError} from "@/lib/server/admin-error-response";

export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"] as const;
export const CAMPAIGN_PLATFORMS = ["META", "INSTAGRAM", "TIKTOK", "YOUTUBE", "EMAIL", "OTHER"] as const;
export const CAMPAIGN_OBJECTIVES = ["AWARENESS", "TRAFFIC", "ENGAGEMENT", "CONVERSIONS", "STREAMS", "PRESAVE", "RETARGETING", "OTHER"] as const;
export const CAMPAIGN_INTERVAL_SOURCES = ["MANUAL", "META_REPORT_SUGGESTION", "EXISTING_CAMPAIGN_RECORD", "IMPORTED_EVIDENCE", "SYSTEM_INFERRED"] as const;
export const CAMPAIGN_CONFIRMATION_STATUSES = ["SUGGESTED", "CONFIRMED", "REJECTED", "SUPERSEDED"] as const;
export const CAMPAIGN_EVENT_TYPES = ["RELEASE_PUBLISHED", "CAMPAIGN_STARTED", "CAMPAIGN_PAUSED", "CAMPAIGN_RESUMED", "CAMPAIGN_ENDED", "BUDGET_CHANGED", "CREATIVE_CHANGED", "AUDIENCE_CHANGED", "ORGANIC_CONTENT_POSTED", "PRESAVE_STARTED", "MAJOR_PLAYLIST_PLACEMENT", "OTHER_RELEASE_PUBLISHED", "MANUAL_NOTE"] as const;
export const CAMPAIGN_EVENT_SOURCES = ["SYSTEM_INTERVAL_SYNC", "USER_ENTERED", "IMPORTED_EVIDENCE", "RELEASE_RECORD"] as const;

export type CampaignActor = {userId: string; username: string};
type Db = typeof prisma | Prisma.TransactionClient;

function clean(value: string | null | undefined, max = 2000) {
  return (value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function json(value: unknown) { return JSON.stringify(value ?? {}); }
function dateOnly(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ? value : null;
}
function date(value: string) {
  const parsed = dateOnly(value);
  if (!parsed) throw new AdminError("Campaign dates must use YYYY-MM-DD calendar dates.", {code: "CAMPAIGN_INTERVAL_INVALID", status: 400});
  return new Date(`${parsed}T00:00:00.000Z`);
}
function timezone(value: string) {
  const normalized = clean(value, 100);
  if (!normalized || normalized === "UNCONFIRMED") throw new AdminError("Confirm a valid IANA timezone before using this interval.", {code: "CAMPAIGN_TIMEZONE_REQUIRED", status: 400});
  try { new Intl.DateTimeFormat("en-US", {timeZone: normalized}).format(new Date()); }
  catch { throw new AdminError("Campaign timezone must be a valid IANA timezone.", {code: "CAMPAIGN_TIMEZONE_REQUIRED", status: 400}); }
  return normalized;
}
function inList<T extends readonly string[]>(value: string, values: T, code: AdminErrorCode) {
  if (!values.includes(value as T[number])) throw new AdminError(`Unsupported value: ${value}.`, {code, status: 400});
  return value as T[number];
}
function inclusiveOverlap(leftStart: Date, leftEnd: Date | null, rightStart: Date, rightEnd: Date | null) {
  const max = new Date("9999-12-31T00:00:00.000Z");
  return leftStart <= (rightEnd ?? max) && rightStart <= (leftEnd ?? max);
}
async function campaignOrThrow(id: string, db: Db = prisma) {
  const campaign = await db.promotionCampaign.findUnique({where: {id}, include: {release: {select: {id: true, title: true, releaseDate: true, primaryArtistProfileId: true, catalogScope: true}}, artistProfile: {select: {id: true, displayName: true, slug: true}}}});
  if (!campaign) throw new AdminError("Promotion campaign was not found.", {code: "CAMPAIGN_NOT_FOUND", status: 404});
  return campaign;
}
function assertNotArchived(campaign: {status: string}) {
  if (campaign.status === "ARCHIVED") throw new AdminError("Archived campaigns cannot be changed.", {code: "CAMPAIGN_ARCHIVED", status: 409});
}
async function validateOwnership(artistProfileId: string, releaseId: string, db: Db = prisma) {
  if (!artistProfileId || !releaseId) throw new AdminError("Campaign artist and promoted release are required.", {code: "CAMPAIGN_RELEASE_REQUIRED", status: 400});
  const [artist, release] = await Promise.all([
    db.artistProfile.findUnique({where: {id: artistProfileId}, select: {id: true, slug: true}}),
    db.release.findUnique({where: {id: releaseId}, select: {id: true, primaryArtistProfileId: true, catalogScope: true, title: true, releaseDate: true}})
  ]);
  if (!artist || !release) throw new AdminError("Campaign artist or promoted release was not found.", {code: "CAMPAIGN_RELEASE_REQUIRED", status: 404});
  const canonicalUnassigned = !release.primaryArtistProfileId && release.catalogScope === "VVVIRUZ" && artist.slug === "vvviruz";
  if (release.primaryArtistProfileId !== artist.id && !canonicalUnassigned) throw new AdminError("The promoted release is not owned by the selected artist.", {code: "CAMPAIGN_ARTIST_MISMATCH", status: 409});
  return {artist, release};
}
async function audit(db: Db, input: {campaignId: string; intervalId?: string | null; timelineEventId?: string | null; evidenceId?: string | null; action: string; reason?: string; previous?: unknown; next?: unknown; actor: CampaignActor; now?: Date}) {
  await db.campaignAuditEvent.create({data: {id: crypto.randomUUID(), campaignId: input.campaignId, intervalId: input.intervalId || null, timelineEventId: input.timelineEventId || null, evidenceId: input.evidenceId || null, action: input.action, reason: clean(input.reason, 500), previousValues: json(input.previous), newValues: json(input.next), actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), createdAt: input.now ?? new Date()}});
}

export async function createPromotionCampaign(input: {actor: CampaignActor; artistProfileId: string; releaseId: string; platform: string; name: string; objective: string; notes?: string; externalCampaignId?: string; externalCampaignName?: string; now?: Date}) {
  const now = input.now ?? new Date();
  await validateOwnership(input.artistProfileId, input.releaseId);
  const name = clean(input.name, 200);
  if (!name) throw new AdminError("Campaign name is required.", {code: "VALIDATION", status: 400});
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.promotionCampaign.create({data: {id: crypto.randomUUID(), artistProfileId: input.artistProfileId, releaseId: input.releaseId, platform: inList(input.platform, CAMPAIGN_PLATFORMS, "VALIDATION"), name, objective: inList(input.objective, CAMPAIGN_OBJECTIVES, "VALIDATION"), status: "DRAFT", notes: clean(input.notes), externalCampaignId: clean(input.externalCampaignId, 200), externalCampaignName: clean(input.externalCampaignName, 300), createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), createdAt: now, updatedAt: now}});
    const release = await tx.release.findUnique({where: {id: input.releaseId}, select: {releaseDate: true, title: true}});
    if (release?.releaseDate) await tx.campaignTimelineEvent.create({data: {id: crypto.randomUUID(), campaignId: created.id, releaseId: created.releaseId, eventType: "RELEASE_PUBLISHED", eventDate: release.releaseDate, timezone: "UTC", title: `${release.title} published`, source: "RELEASE_RECORD", confirmationStatus: "CONFIRMED", createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), createdAt: now, updatedAt: now}});
    await audit(tx, {campaignId: created.id, action: "CAMPAIGN_CREATED", next: created, actor: input.actor, now});
    return created;
  });
  return {ok: true as const, code: "CAMPAIGN_CREATED", message: "Promotion campaign created.", campaignId: campaign.id};
}

export async function updatePromotionCampaign(id: string, input: {actor: CampaignActor; name?: string; platform?: string; objective?: string; status?: string; notes?: string; externalCampaignId?: string; externalCampaignName?: string; reason?: string; now?: Date}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const current = await campaignOrThrow(id, tx); assertNotArchived(current);
    const status = input.status ? inList(input.status, CAMPAIGN_STATUSES, "VALIDATION") : current.status;
    if (status === "ARCHIVED" && !clean(input.reason, 500)) throw new AdminError("Archiving a campaign requires a reason.", {code: "CAMPAIGN_REASON_REQUIRED", status: 400});
    if (status !== current.status && ["ACTIVE", "PAUSED", "ENDED"].includes(status)) {
      const [open, confirmed] = await Promise.all([
        tx.campaignActiveInterval.count({where: {campaignId: id, confirmationStatus: "CONFIRMED", activeEndDate: null, supersededBy: null}}),
        tx.campaignActiveInterval.count({where: {campaignId: id, confirmationStatus: "CONFIRMED", supersededBy: null}})
      ]);
      if (status === "ACTIVE" && !open) throw new AdminError("Add an open confirmed interval before marking the campaign active.", {code: "CAMPAIGN_CONFLICT", status: 409});
      if ((status === "PAUSED" || status === "ENDED") && open) throw new AdminError(`${status === "PAUSED" ? "Close" : "End"} every open confirmed interval before marking the campaign ${status.toLowerCase()}.`, {code: "CAMPAIGN_CONFLICT", status: 409});
      if ((status === "PAUSED" || status === "ENDED") && !confirmed) throw new AdminError("Add confirmed interval history before applying this lifecycle status.", {code: "CAMPAIGN_CONFLICT", status: 409});
    }
    const next = await tx.promotionCampaign.update({where: {id}, data: {name: input.name === undefined ? undefined : clean(input.name, 200), platform: input.platform ? inList(input.platform, CAMPAIGN_PLATFORMS, "VALIDATION") : undefined, objective: input.objective ? inList(input.objective, CAMPAIGN_OBJECTIVES, "VALIDATION") : undefined, status, notes: input.notes === undefined ? undefined : clean(input.notes), externalCampaignId: input.externalCampaignId === undefined ? undefined : clean(input.externalCampaignId, 200), externalCampaignName: input.externalCampaignName === undefined ? undefined : clean(input.externalCampaignName, 300), archivedAt: status === "ARCHIVED" ? now : null, updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), updatedAt: now}});
    await audit(tx, {campaignId: id, action: status === "ARCHIVED" ? "CAMPAIGN_ARCHIVED" : "CAMPAIGN_UPDATED", reason: input.reason, previous: current, next, actor: input.actor, now});
    await syncIntervalEvents(tx, id, input.actor, now);
    return {ok: true as const, code: status === "ARCHIVED" ? "CAMPAIGN_ARCHIVED" : "CAMPAIGN_UPDATED", message: "Campaign updated.", campaignId: id};
  });
}

async function validateIntervalConflict(db: Db, campaignId: string, start: Date, end: Date | null, excludeId?: string) {
  const intervals = await db.campaignActiveInterval.findMany({where: {campaignId, confirmationStatus: "CONFIRMED", supersededBy: null, ...(excludeId ? {id: {not: excludeId}} : {})}, select: {id: true, activeStartDate: true, activeEndDate: true}});
  if (intervals.some((interval) => interval.activeStartDate.getTime() === start.getTime() && (interval.activeEndDate?.getTime() ?? null) === (end?.getTime() ?? null))) throw new AdminError("An identical confirmed interval already exists.", {code: "CAMPAIGN_INTERVAL_OVERLAP", status: 409});
  if (intervals.some((interval) => inclusiveOverlap(interval.activeStartDate, interval.activeEndDate, start, end))) throw new AdminError("Confirmed intervals in one campaign cannot overlap. Adjacent next-day intervals remain separate.", {code: "CAMPAIGN_INTERVAL_OVERLAP", status: 409});
  if (!end && intervals.some((interval) => !interval.activeEndDate)) throw new AdminError("This campaign already has an open confirmed interval.", {code: "CAMPAIGN_OPEN_INTERVAL_EXISTS", status: 409});
}

async function syncIntervalEvents(db: Db, campaignId: string, actor: CampaignActor, now: Date) {
  const campaign = await db.promotionCampaign.findUnique({where: {id: campaignId}, select: {releaseId: true, status: true}});
  if (!campaign) return;
  await db.campaignTimelineEvent.updateMany({where: {campaignId, source: "SYSTEM_INTERVAL_SYNC", confirmationStatus: "CONFIRMED"}, data: {confirmationStatus: "SUPERSEDED", revokedAt: now, updatedById: actor.userId, updatedByUsername: clean(actor.username, 120), updatedAt: now}});
  const intervals = await db.campaignActiveInterval.findMany({where: {campaignId, confirmationStatus: "CONFIRMED", supersededBy: null}, orderBy: [{activeStartDate: "asc"}, {id: "asc"}]});
  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index];
    const startType = index === 0 ? "CAMPAIGN_STARTED" : "CAMPAIGN_RESUMED";
    await db.campaignTimelineEvent.create({data: {id: crypto.randomUUID(), campaignId, releaseId: campaign.releaseId, intervalId: interval.id, eventType: startType, eventDate: interval.activeStartDate, timezone: interval.timezone, title: index === 0 ? "Campaign started" : "Campaign resumed", source: "SYSTEM_INTERVAL_SYNC", confirmationStatus: "CONFIRMED", metadata: json({inclusiveBoundary: true}), createdById: actor.userId, createdByUsername: clean(actor.username, 120), updatedById: actor.userId, updatedByUsername: clean(actor.username, 120), createdAt: now, updatedAt: now}});
    if (interval.activeEndDate) {
      const finalEnded = index === intervals.length - 1 && campaign.status === "ENDED";
      await db.campaignTimelineEvent.create({data: {id: crypto.randomUUID(), campaignId, releaseId: campaign.releaseId, intervalId: interval.id, eventType: finalEnded ? "CAMPAIGN_ENDED" : "CAMPAIGN_PAUSED", eventDate: interval.activeEndDate, timezone: interval.timezone, title: finalEnded ? "Campaign ended" : "Campaign paused after this inclusive date", source: "SYSTEM_INTERVAL_SYNC", confirmationStatus: "CONFIRMED", metadata: json({inclusiveBoundary: true}), createdById: actor.userId, createdByUsername: clean(actor.username, 120), updatedById: actor.userId, updatedByUsername: clean(actor.username, 120), createdAt: now, updatedAt: now}});
    }
  }
}

export async function addCampaignInterval(campaignId: string, input: {actor: CampaignActor; activeStartDate: string; activeEndDate?: string | null; timezone: string; sourceType?: string; confirmationStatus?: string; evidenceId?: string | null; notes?: string; now?: Date}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const campaign = await campaignOrThrow(campaignId, tx); assertNotArchived(campaign);
    const start = date(input.activeStartDate); const end = input.activeEndDate ? date(input.activeEndDate) : null;
    if (end && end < start) throw new AdminError("Interval end cannot be before start.", {code: "CAMPAIGN_INTERVAL_INVALID", status: 400});
    const confirmationStatus = inList(input.confirmationStatus || "CONFIRMED", CAMPAIGN_CONFIRMATION_STATUSES, "CAMPAIGN_INTERVAL_INVALID");
    const sourceType = inList(input.sourceType || "MANUAL", CAMPAIGN_INTERVAL_SOURCES, "CAMPAIGN_INTERVAL_INVALID");
    const zone = confirmationStatus === "CONFIRMED" ? timezone(input.timezone) : clean(input.timezone, 100) || "UNCONFIRMED";
    if (confirmationStatus === "CONFIRMED") await validateIntervalConflict(tx, campaignId, start, end);
    if (input.evidenceId) {
      const evidence = await tx.campaignEvidence.findUnique({where: {id: input.evidenceId}});
      if (!evidence || evidence.campaignId !== campaignId) throw new AdminError("Campaign suggestion was not found.", {code: "CAMPAIGN_SUGGESTION_NOT_FOUND", status: 404});
    }
    const interval = await tx.campaignActiveInterval.create({data: {id: crypto.randomUUID(), campaignId, activeStartDate: start, activeEndDate: end, timezone: zone, sourceType, confirmationStatus, evidenceId: input.evidenceId || null, notes: clean(input.notes), createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), confirmedById: confirmationStatus === "CONFIRMED" ? input.actor.userId : null, confirmedByUsername: confirmationStatus === "CONFIRMED" ? clean(input.actor.username, 120) : "", confirmedAt: confirmationStatus === "CONFIRMED" ? now : null, createdAt: now, updatedAt: now}});
    await audit(tx, {campaignId, intervalId: interval.id, action: confirmationStatus === "CONFIRMED" ? "INTERVAL_CONFIRMED" : "INTERVAL_SUGGESTED", next: interval, actor: input.actor, now});
    if (confirmationStatus === "CONFIRMED") await syncIntervalEvents(tx, campaignId, input.actor, now);
    return {ok: true as const, code: "CAMPAIGN_INTERVAL_CREATED", message: "Campaign interval created.", intervalId: interval.id};
  });
}

export async function resolveCampaignSuggestion(campaignId: string, intervalId: string, input: {actor: CampaignActor; action: "CONFIRM" | "REJECT"; activeStartDate?: string; activeEndDate?: string | null; timezone?: string; reason?: string; now?: Date}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const campaign = await campaignOrThrow(campaignId, tx); assertNotArchived(campaign);
    const suggestion = await tx.campaignActiveInterval.findUnique({where: {id: intervalId}, include: {supersededBy: {select: {id: true}}}});
    if (!suggestion || suggestion.campaignId !== campaignId) throw new AdminError("Campaign suggestion was not found.", {code: "CAMPAIGN_SUGGESTION_NOT_FOUND", status: 404});
    if (suggestion.confirmationStatus !== "SUGGESTED" || suggestion.supersededBy) throw new AdminError("Campaign suggestion was already resolved.", {code: "CAMPAIGN_SUGGESTION_ALREADY_RESOLVED", status: 409});
    const reason = clean(input.reason, 500);
    if (input.action === "REJECT") {
      if (!reason) throw new AdminError("Rejecting a suggestion requires a reason.", {code: "CAMPAIGN_REASON_REQUIRED", status: 400});
      await tx.campaignActiveInterval.update({where: {id: intervalId}, data: {confirmationStatus: "REJECTED", rejectedById: input.actor.userId, rejectedByUsername: clean(input.actor.username, 120), rejectedAt: now, correctionReason: reason, updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), updatedAt: now}});
      await audit(tx, {campaignId, intervalId, evidenceId: suggestion.evidenceId, action: "SUGGESTION_REJECTED", reason, previous: suggestion, actor: input.actor, now});
      return {ok: true as const, code: "CAMPAIGN_SUGGESTION_REJECTED", message: "Suggestion rejected and preserved."};
    }
    const start = input.activeStartDate ? date(input.activeStartDate) : suggestion.activeStartDate;
    const end = input.activeEndDate === undefined ? suggestion.activeEndDate : input.activeEndDate ? date(input.activeEndDate) : null;
    if (end && end < start) throw new AdminError("Interval end cannot be before start.", {code: "CAMPAIGN_INTERVAL_INVALID", status: 400});
    const zone = timezone(input.timezone || suggestion.timezone);
    await validateIntervalConflict(tx, campaignId, start, end);
    const confirmed = await tx.campaignActiveInterval.create({data: {id: crypto.randomUUID(), campaignId, activeStartDate: start, activeEndDate: end, timezone: zone, sourceType: suggestion.sourceType, confirmationStatus: "CONFIRMED", evidenceId: suggestion.evidenceId, supersedesIntervalId: suggestion.id, notes: suggestion.notes, correctionReason: reason, createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), confirmedById: input.actor.userId, confirmedByUsername: clean(input.actor.username, 120), confirmedAt: now, createdAt: now, updatedAt: now}});
    await tx.campaignActiveInterval.update({where: {id: suggestion.id}, data: {confirmationStatus: "SUPERSEDED", updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), updatedAt: now}});
    await audit(tx, {campaignId, intervalId: confirmed.id, evidenceId: suggestion.evidenceId, action: "SUGGESTION_CONFIRMED", reason, previous: suggestion, next: confirmed, actor: input.actor, now});
    await syncIntervalEvents(tx, campaignId, input.actor, now);
    return {ok: true as const, code: "CAMPAIGN_SUGGESTION_CONFIRMED", message: "Suggestion confirmed as an authoritative interval.", intervalId: confirmed.id};
  });
}

export async function correctCampaignInterval(campaignId: string, intervalId: string, input: {actor: CampaignActor; activeStartDate: string; activeEndDate?: string | null; timezone: string; reason: string; now?: Date}) {
  const now = input.now ?? new Date(); const reason = clean(input.reason, 500);
  if (!reason) throw new AdminError("Correcting an interval requires a reason.", {code: "CAMPAIGN_REASON_REQUIRED", status: 400});
  return prisma.$transaction(async (tx) => {
    const campaign = await campaignOrThrow(campaignId, tx); assertNotArchived(campaign);
    const current = await tx.campaignActiveInterval.findUnique({where: {id: intervalId}, include: {supersededBy: {select: {id: true}}}});
    if (!current || current.campaignId !== campaignId) throw new AdminError("Campaign interval was not found.", {code: "CAMPAIGN_INTERVAL_NOT_FOUND", status: 404});
    if (current.confirmationStatus !== "CONFIRMED" || current.supersededBy) throw new AdminError("Only a current confirmed interval can be corrected.", {code: "CAMPAIGN_INTERVAL_NOT_CONFIRMED", status: 409});
    const start = date(input.activeStartDate); const end = input.activeEndDate ? date(input.activeEndDate) : null;
    if (end && end < start) throw new AdminError("Interval end cannot be before start.", {code: "CAMPAIGN_INTERVAL_INVALID", status: 400});
    await validateIntervalConflict(tx, campaignId, start, end, intervalId);
    const replacement = await tx.campaignActiveInterval.create({data: {id: crypto.randomUUID(), campaignId, activeStartDate: start, activeEndDate: end, timezone: timezone(input.timezone), sourceType: current.sourceType, confirmationStatus: "CONFIRMED", evidenceId: current.evidenceId, supersedesIntervalId: current.id, notes: current.notes, correctionReason: reason, createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), confirmedById: input.actor.userId, confirmedByUsername: clean(input.actor.username, 120), confirmedAt: now, createdAt: now, updatedAt: now}});
    await tx.campaignActiveInterval.update({where: {id: current.id}, data: {confirmationStatus: "SUPERSEDED", updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), updatedAt: now}});
    await audit(tx, {campaignId, intervalId: replacement.id, action: "INTERVAL_CORRECTED", reason, previous: current, next: replacement, actor: input.actor, now});
    await syncIntervalEvents(tx, campaignId, input.actor, now);
    return {ok: true as const, code: "CAMPAIGN_INTERVAL_CORRECTED", message: "Interval corrected with prior history preserved.", intervalId: replacement.id};
  });
}

export async function addCampaignEvent(campaignId: string, input: {actor: CampaignActor; eventType: string; eventDate: string; eventTime?: string; timezone: string; title: string; notes?: string; metadata?: Record<string, unknown>; now?: Date}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const campaign = await campaignOrThrow(campaignId, tx); assertNotArchived(campaign);
    const eventType = inList(input.eventType, CAMPAIGN_EVENT_TYPES, "CAMPAIGN_EVENT_INVALID");
    if (["CAMPAIGN_STARTED", "CAMPAIGN_PAUSED", "CAMPAIGN_RESUMED", "CAMPAIGN_ENDED"].includes(eventType)) throw new AdminError("Lifecycle events are synchronized from confirmed intervals.", {code: "CAMPAIGN_EVENT_INVALID", status: 400});
    const title = clean(input.title, 240); if (!title) throw new AdminError("Event title is required.", {code: "CAMPAIGN_EVENT_INVALID", status: 400});
    const eventTime = clean(input.eventTime, 8); if (eventTime && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(eventTime)) throw new AdminError("Event time must use HH:mm or HH:mm:ss.", {code: "CAMPAIGN_EVENT_INVALID", status: 400});
    const event = await tx.campaignTimelineEvent.create({data: {id: crypto.randomUUID(), campaignId, releaseId: campaign.releaseId, eventType, eventDate: date(input.eventDate), eventTime, timezone: timezone(input.timezone), title, notes: clean(input.notes), metadata: json(input.metadata), source: "USER_ENTERED", confirmationStatus: "CONFIRMED", createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), createdAt: now, updatedAt: now}});
    await audit(tx, {campaignId, timelineEventId: event.id, action: "EVENT_CREATED", next: event, actor: input.actor, now});
    return {ok: true as const, code: "CAMPAIGN_EVENT_CREATED", message: "Timeline event added.", eventId: event.id};
  });
}

export async function correctCampaignEvent(campaignId: string, eventId: string, input: {actor: CampaignActor; eventDate: string; eventTime?: string; timezone: string; title: string; notes?: string; reason: string; now?: Date}) {
  const now = input.now ?? new Date(); const reason = clean(input.reason, 500);
  if (!reason) throw new AdminError("Correcting an event requires a reason.", {code: "CAMPAIGN_REASON_REQUIRED", status: 400});
  return prisma.$transaction(async (tx) => {
    const campaign = await campaignOrThrow(campaignId, tx); assertNotArchived(campaign);
    const current = await tx.campaignTimelineEvent.findUnique({where: {id: eventId}, include: {supersededBy: {select: {id: true}}}});
    if (!current || current.campaignId !== campaignId || current.source !== "USER_ENTERED" || current.confirmationStatus !== "CONFIRMED" || current.supersededBy) throw new AdminError("This descriptive event cannot be corrected.", {code: "CAMPAIGN_EVENT_INVALID", status: 409});
    const replacement = await tx.campaignTimelineEvent.create({data: {id: crypto.randomUUID(), campaignId, releaseId: current.releaseId, eventType: current.eventType, eventDate: date(input.eventDate), eventTime: clean(input.eventTime, 8), timezone: timezone(input.timezone), title: clean(input.title, 240), notes: clean(input.notes), metadata: current.metadata, source: "USER_ENTERED", confirmationStatus: "CONFIRMED", supersedesEventId: current.id, correctionReason: reason, createdById: input.actor.userId, createdByUsername: clean(input.actor.username, 120), updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), createdAt: now, updatedAt: now}});
    await tx.campaignTimelineEvent.update({where: {id: current.id}, data: {confirmationStatus: "SUPERSEDED", revokedAt: now, updatedById: input.actor.userId, updatedByUsername: clean(input.actor.username, 120), updatedAt: now}});
    await audit(tx, {campaignId, timelineEventId: replacement.id, action: "EVENT_CORRECTED", reason, previous: current, next: replacement, actor: input.actor, now});
    return {ok: true as const, code: "CAMPAIGN_EVENT_CORRECTED", message: "Event corrected with prior history preserved.", eventId: replacement.id};
  });
}

function serializeDate(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? null; }
function safeJson(value: string) { try { return JSON.parse(value) as unknown; } catch { return {}; } }
export async function readCampaignOverlaps(campaignId: string, options: {futureWindowEndDate?: string} = {}) {
  const campaign = await campaignOrThrow(campaignId);
  const futureWindowEnd = options.futureWindowEndDate ? date(options.futureWindowEndDate) : null;
  const own = await prisma.campaignActiveInterval.findMany({where: {campaignId, confirmationStatus: "CONFIRMED", supersededBy: null}, orderBy: {activeStartDate: "asc"}});
  const others = await prisma.campaignActiveInterval.findMany({where: {campaignId: {not: campaignId}, confirmationStatus: "CONFIRMED", supersededBy: null, campaign: {status: {not: "ARCHIVED"}}}, include: {campaign: {select: {id: true, name: true, releaseId: true, release: {select: {title: true}}}}}});
  const overlaps: Array<Record<string, unknown>> = [];
  for (const interval of own) {
    if (!interval.activeEndDate) overlaps.push({type: "OPEN_CAMPAIGN", campaignId, intervalId: interval.id, startDate: serializeDate(interval.activeStartDate), endDate: null});
    for (const other of others) if (inclusiveOverlap(interval.activeStartDate, interval.activeEndDate, other.activeStartDate, other.activeEndDate)) overlaps.push({type: other.campaign.releaseId === campaign.releaseId ? "SAME_RELEASE_CAMPAIGN" : "DIFFERENT_RELEASE_CAMPAIGN", campaignId: other.campaign.id, campaignName: other.campaign.name, releaseId: other.campaign.releaseId, releaseTitle: other.campaign.release.title, intervalId: other.id, overlapStartDate: serializeDate(interval.activeStartDate > other.activeStartDate ? interval.activeStartDate : other.activeStartDate), overlapEndDate: serializeDate(!interval.activeEndDate ? other.activeEndDate : !other.activeEndDate ? interval.activeEndDate : interval.activeEndDate < other.activeEndDate ? interval.activeEndDate : other.activeEndDate)});
    const releases = await prisma.release.findMany({where: {id: {not: campaign.releaseId}, releaseDate: {gte: interval.activeStartDate, ...(interval.activeEndDate ? {lte: interval.activeEndDate} : {})}}, select: {id: true, title: true, releaseDate: true}});
    for (const release of releases) overlaps.push({type: "OTHER_RELEASE_PUBLISHED", releaseId: release.id, releaseTitle: release.title, eventDate: serializeDate(release.releaseDate), campaignId});
    if (futureWindowEnd && interval.activeEndDate && futureWindowEnd > interval.activeEndDate) {
      const futureReleases = await prisma.release.findMany({where: {id: {not: campaign.releaseId}, releaseDate: {gt: interval.activeEndDate, lte: futureWindowEnd}}, select: {id: true, title: true, releaseDate: true}});
      for (const release of futureReleases) overlaps.push({type: "OTHER_RELEASE_IN_FUTURE_WINDOW", releaseId: release.id, releaseTitle: release.title, eventDate: serializeDate(release.releaseDate), campaignId, windowStartExclusive: serializeDate(interval.activeEndDate), windowEndInclusive: serializeDate(futureWindowEnd)});
    }
  }
  return overlaps;
}

export async function listPromotionCampaigns(filters: {page?: number; pageSize?: number; releaseId?: string; platform?: string; status?: string; activeDate?: string; confirmationStatus?: string} = {}) {
  const page = Math.max(1, Math.floor(filters.page || 1)); const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize || 25)));
  const activeDate = filters.activeDate ? date(filters.activeDate) : null;
  const where: Prisma.PromotionCampaignWhereInput = {releaseId: filters.releaseId || undefined, platform: filters.platform || undefined, status: filters.status || undefined, ...(filters.confirmationStatus || activeDate ? {activeIntervals: {some: {...(filters.confirmationStatus ? {confirmationStatus: filters.confirmationStatus} : {}), ...(activeDate ? {activeStartDate: {lte: activeDate}, OR: [{activeEndDate: null}, {activeEndDate: {gte: activeDate}}]} : {})}}} : {})};
  const [total, items] = await Promise.all([prisma.promotionCampaign.count({where}), prisma.promotionCampaign.findMany({where, orderBy: [{updatedAt: "desc"}, {id: "desc"}], skip: (page - 1) * pageSize, take: pageSize, include: {release: {select: {id: true, title: true, releaseDate: true}}, artistProfile: {select: {id: true, displayName: true}}, activeIntervals: {where: {supersededBy: null}, orderBy: {activeStartDate: "asc"}}}})]);
  const enriched = await Promise.all(items.map(async (item) => ({...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), archivedAt: item.archivedAt?.toISOString() ?? null, release: {...item.release, releaseDate: serializeDate(item.release.releaseDate)}, activeIntervals: item.activeIntervals.map((interval) => ({...interval, activeStartDate: serializeDate(interval.activeStartDate), activeEndDate: serializeDate(interval.activeEndDate), confirmedAt: interval.confirmedAt?.toISOString() ?? null, rejectedAt: interval.rejectedAt?.toISOString() ?? null, createdAt: interval.createdAt.toISOString(), updatedAt: interval.updatedAt.toISOString()})), overlaps: await readCampaignOverlaps(item.id)})));
  return {page, pageSize, total, items: enriched};
}

export async function readPromotionCampaign(id: string, options: {futureWindowEndDate?: string} = {}) {
  await campaignOrThrow(id);
  const record = await prisma.promotionCampaign.findUnique({where: {id}, include: {release: {select: {id: true, title: true, releaseDate: true}}, artistProfile: {select: {id: true, displayName: true, slug: true}}, activeIntervals: {orderBy: [{activeStartDate: "asc"}, {createdAt: "asc"}], include: {evidence: {select: {id: true, sourceType: true, campaignName: true, importedStartDate: true, importedEndDate: true, spendStartDate: true, spendEndDate: true, rationale: true, confidence: true, timezone: true, adImportBatchId: true}}}}, timelineEvents: {orderBy: [{eventDate: "asc"}, {createdAt: "asc"}]}, evidence: {orderBy: {createdAt: "asc"}}, auditEvents: {orderBy: {createdAt: "asc"}}, metaPromotionLinks: {orderBy: [{createdAt: "asc"}, {id: "asc"}], include: {supersededBy: {select: {id: true}}, auditEvents: {orderBy: {createdAt: "asc"}}}}}});
  if (!record) throw new AdminError("Promotion campaign was not found.", {code: "CAMPAIGN_NOT_FOUND", status: 404});
  return JSON.parse(JSON.stringify({...record, activeIntervals: record.activeIntervals.map((interval) => ({...interval, activeStartDate: serializeDate(interval.activeStartDate), activeEndDate: serializeDate(interval.activeEndDate), evidence: interval.evidence ? {...interval.evidence, importedStartDate: serializeDate(interval.evidence.importedStartDate), importedEndDate: serializeDate(interval.evidence.importedEndDate), spendStartDate: serializeDate(interval.evidence.spendStartDate), spendEndDate: serializeDate(interval.evidence.spendEndDate)} : null})), timelineEvents: record.timelineEvents.map((event) => ({...event, eventDate: serializeDate(event.eventDate), metadata: safeJson(event.metadata)})), evidence: record.evidence.map((evidence) => ({...evidence, importedStartDate: serializeDate(evidence.importedStartDate), importedEndDate: serializeDate(evidence.importedEndDate), spendStartDate: serializeDate(evidence.spendStartDate), spendEndDate: serializeDate(evidence.spendEndDate), suggestedStartDate: serializeDate(evidence.suggestedStartDate), suggestedEndDate: serializeDate(evidence.suggestedEndDate), metadata: safeJson(evidence.metadata)})), auditEvents: record.auditEvents.map((event) => ({...event, previousValues: safeJson(event.previousValues), newValues: safeJson(event.newValues)})), metaPromotionLinks: record.metaPromotionLinks.map((link) => ({...link, evidence: safeJson(link.evidence), auditEvents: link.auditEvents.map((event) => ({...event, previousValues: safeJson(event.previousValues), newValues: safeJson(event.newValues)}))})), overlaps: await readCampaignOverlaps(id, options)}));
}

export async function generateMetaIntervalSuggestions(campaignId: string, actor: CampaignActor, now = new Date()) {
  const campaign = await campaignOrThrow(campaignId); assertNotArchived(campaign);
  if (campaign.platform !== "META" && campaign.platform !== "INSTAGRAM") return {ok: true as const, code: "NO_META_EVIDENCE", message: "This campaign platform has no Meta evidence suggestions.", created: 0};
  const confirmedLinks = await prisma.metaPromotionLink.findMany({where: {promotionCampaignId: campaignId, status: "CONFIRMED", supersededBy: null}, orderBy: [{createdAt: "asc"}, {id: "asc"}]});
  const links = selectMostSpecificMetaPromotionLinks(confirmedLinks);
  if (!links.length) return {ok: true as const, code: "META_LINK_CONFIRMATION_REQUIRED", message: "Confirm at least one scoped external Meta promotion link before generating timeline evidence.", created: 0, evidenceOnly: 0};
  if (new Set(links.map((link) => link.scopeIdentityKey)).size !== links.length) throw new AdminError("Multiple current links claim the same external Meta scope for this campaign.", {code: "CONFLICT", status: 409});
  let created = 0;
  for (const link of links) {
    const resolutions = await prisma.metaDailyResolution.findMany({
      where: {...metaPromotionScopeWhere(link), metricFamily: "SPEND", currentObservation: {importBatch: {coreTimingEligible: true, importState: "ACCEPTED", withdrawnAt: null}}},
      include: {currentObservation: true}, orderBy: [{metricDate: "asc"}, {id: "asc"}]
    });
    const byDay = new Map<string, Array<{spend: number; currency: string}>>();
    for (const resolution of resolutions) {
      const day = dateOnly(resolution.metricDate)!; const spend = resolution.currentObservation.spend;
      if (spend !== null) byDay.set(day, [...(byDay.get(day) ?? []), {spend, currency: resolution.currency || resolution.currentObservation.currency}]);
    }
    const currencies = [...new Set([...byDay.values()].flat().map((item) => item.currency).filter(Boolean))].sort();
    const positiveDates = [...byDay.entries()].filter(([, values]) => values.some(({spend}) => spend > 0)).map(([day]) => day).sort();
    const explicitZeroDates = new Set([...byDay.entries()].filter(([, values]) => values.length > 0 && values.every(({spend}) => spend === 0)).map(([day]) => day));
    const segments: Array<{start: string; end: string}> = [];
    for (const day of positiveDates) {
      const prior = segments.at(-1); if (!prior) {segments.push({start: day, end: day}); continue;}
      const cursor = new Date(`${prior.end}T00:00:00.000Z`); cursor.setUTCDate(cursor.getUTCDate() + 1); let explicitZeroBetween = false;
      while (cursor < new Date(`${day}T00:00:00.000Z`)) { if (explicitZeroDates.has(cursor.toISOString().slice(0, 10))) explicitZeroBetween = true; cursor.setUTCDate(cursor.getUTCDate() + 1); }
      if (explicitZeroBetween) segments.push({start: day, end: day}); else prior.end = day; // UNKNOWN gaps never close a campaign.
    }
    const sourceResolutionFingerprint = createHash("sha256").update(JSON.stringify(resolutions.map((item) => [item.id, item.resolutionVersion, item.currentObservationId, dateOnly(item.metricDate), item.currency, item.currentObservation.spend]))).digest("hex");
    const currentEvidence = await prisma.campaignEvidence.findMany({where: {campaignId, suggestionState: "CURRENT", suggestionKey: {startsWith: `meta:${link.id}:`}}, include: {suggestedIntervals: true}});
    const currentByKey = new Map(currentEvidence.map((item) => [item.suggestionKey, item]));
    const desiredKeys = new Set<string>();
    for (const [index, segment] of segments.entries()) {
      const suggestionKey = `meta:${link.id}:ACTIVE_EVIDENCE_WINDOW:${index + 1}`; desiredKeys.add(suggestionKey);
      const prior = currentByKey.get(suggestionKey);
      if (prior?.sourceResolutionFingerprint === sourceResolutionFingerprint && dateOnly(prior.suggestedStartDate) === segment.start && dateOnly(prior.suggestedEndDate) === segment.end) continue;
      await prisma.$transaction(async (tx) => {
        const winner = resolutions.find((item) => dateOnly(item.metricDate) === segment.start)?.currentObservation;
        const evidenceId = crypto.randomUUID();
        const generationVersion = (prior?.generationVersion ?? 0) + 1;
        const evidence = await tx.campaignEvidence.create({data: {id: evidenceId, campaignId, adImportBatchId: winner?.importBatchId ?? null, sourceType: "META_IMPORT_BATCH", sourceRecordId: `canonical-daily:${suggestionKey}:${sourceResolutionFingerprint}`, suggestionKey, generationVersion, sourceResolutionFingerprint, suggestionState: "CURRENT", campaignName: link.currentDisplayName, spendStartDate: date(segment.start), spendEndDate: date(segment.end), suggestedStartDate: date(segment.start), suggestedEndDate: date(segment.end), timezone: winner?.normalizedTimezone ?? "", rationale: "First and last observed positive-spend days are conservative activity evidence, not proven campaign boundaries. Missing dates remain UNKNOWN; explicit zeroes do not confirm pauses.", confidence: positiveDates.length > 1 ? "HIGH" : "MEDIUM", metadata: json({evidencePrimitives: {first: "FIRST_ACTIVE_EVIDENCE", withinWindow: "ACTIVE_EVIDENCE", last: "LAST_ACTIVE_EVIDENCE", zeroDates: "EXPLICIT_ZERO", gaps: "UNKNOWN", resumesAfterZero: "ACTIVE_EVIDENCE_RESUMES"}, externalLinkId: link.id, accountId: link.accountId, scopeType: link.scopeType, externalCampaignId: link.externalCampaignId, externalAdSetId: link.externalAdSetId, externalAdId: link.externalAdId, scopeIdentityKey: link.scopeIdentityKey, associationMode: link.associationMode, spendAllocation: link.monetaryAttribution, ambiguous: link.ambiguous, currencyStatus: currencies.length > 1 ? "MULTIPLE_CURRENCIES_NO_MONETARY_AGGREGATE" : "SINGLE_CURRENCY", currencies, positiveSpendDates: positiveDates.length, explicitZeroDates: [...explicitZeroDates], canonicalResolutionOnly: true, nameBasedLinking: false}), createdById: actor.userId, createdByUsername: clean(actor.username, 120), createdAt: now, updatedAt: now}});
        const interval = await tx.campaignActiveInterval.create({data: {id: crypto.randomUUID(), campaignId, activeStartDate: date(segment.start), activeEndDate: date(segment.end), timezone: "UNCONFIRMED", sourceType: "META_REPORT_SUGGESTION", confirmationStatus: "SUGGESTED", evidenceId: evidence.id, notes: "Admin confirmation and timezone are required.", createdById: actor.userId, createdByUsername: clean(actor.username, 120), updatedById: actor.userId, updatedByUsername: clean(actor.username, 120), createdAt: now, updatedAt: now}});
        if (prior) {
          await tx.campaignActiveInterval.updateMany({where: {evidenceId: prior.id, confirmationStatus: "SUGGESTED", supersededBy: null}, data: {confirmationStatus: "SUPERSEDED", updatedById: actor.userId, updatedByUsername: clean(actor.username, 120), updatedAt: now}});
          await tx.campaignEvidence.update({where: {id: prior.id}, data: {suggestionState: "SUPERSEDED", supersededByEvidenceId: evidence.id, updatedAt: now}});
        }
        await audit(tx, {campaignId, intervalId: interval.id, evidenceId: evidence.id, action: prior ? "META_SUGGESTION_SUPERSEDED" : "META_SUGGESTION_CREATED", previous: prior ? {evidenceId: prior.id, fingerprint: prior.sourceResolutionFingerprint} : undefined, next: {segment, confidence: evidence.confidence, fingerprint: sourceResolutionFingerprint, associationMode: link.associationMode}, actor, now});
      }); created += 1;
    }
    for (const stale of currentEvidence.filter((item) => !desiredKeys.has(item.suggestionKey))) {
      await prisma.$transaction(async (tx) => {
        await tx.campaignActiveInterval.updateMany({where: {evidenceId: stale.id, confirmationStatus: "SUGGESTED", supersededBy: null}, data: {confirmationStatus: "SUPERSEDED", updatedById: actor.userId, updatedByUsername: clean(actor.username, 120), updatedAt: now}});
        await tx.campaignEvidence.update({where: {id: stale.id}, data: {suggestionState: "SUPERSEDED", updatedAt: now}});
        await audit(tx, {campaignId, evidenceId: stale.id, action: "META_SUGGESTION_INVALIDATED", previous: {fingerprint: stale.sourceResolutionFingerprint}, next: {fingerprint: sourceResolutionFingerprint}, actor, now});
      });
    }
  }
  return {ok: true as const, code: "META_SUGGESTIONS_GENERATED", message: "Canonical Meta evidence reviewed; suggestions remain unconfirmed.", created, evidenceOnly: 0};
}

export async function readReleaseCampaignTimeline(releaseId: string) {
  const campaigns = await listPromotionCampaigns({releaseId, pageSize: 100});
  const events = await prisma.campaignTimelineEvent.findMany({where: {releaseId, confirmationStatus: {in: ["CONFIRMED", "SUGGESTED"]}}, orderBy: [{eventDate: "asc"}, {createdAt: "asc"}]});
  return {campaigns: campaigns.items, events: events.map((event) => ({...event, eventDate: serializeDate(event.eventDate), metadata: safeJson(event.metadata)}))};
}
