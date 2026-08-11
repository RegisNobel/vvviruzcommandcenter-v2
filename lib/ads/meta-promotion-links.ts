import "server-only";

import {randomUUID} from "node:crypto";
import {prisma} from "@/lib/db/prisma";
import {AdminError} from "@/lib/server/admin-error-response";

export type MetaPromotionScopeType = "CAMPAIGN" | "AD_SET" | "AD";
type Actor = {userId: string; username: string};
type ScopeInput = {accountId: string; externalCampaignId: string; externalAdSetId?: string; externalAdId?: string; scopeType: string};
type CurrentLink = {id: string; promotionCampaignId: string; accountId: string; scopeType: string; externalCampaignId: string; externalAdSetId: string; externalAdId: string; scopeIdentityKey: string; currentDisplayName: string; status: string; associationMode: string; monetaryAttribution: string; ambiguous: boolean; evidence: string};

const statuses = new Set(["SUGGESTED", "CONFIRMED", "REJECTED", "REVOKED"]);
const scopes = new Set<MetaPromotionScopeType>(["CAMPAIGN", "AD_SET", "AD"]);
const scopeRank: Record<MetaPromotionScopeType, number> = {CAMPAIGN: 1, AD_SET: 2, AD: 3};

function clean(value: string, max: number) { return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max); }
function normalizeScope(input: ScopeInput) {
  const scopeType = input.scopeType.trim().toUpperCase() as MetaPromotionScopeType;
  const accountId = clean(input.accountId, 200);
  const externalCampaignId = clean(input.externalCampaignId, 200);
  const externalAdSetId = clean(input.externalAdSetId ?? "", 200);
  const externalAdId = clean(input.externalAdId ?? "", 200);
  if (!scopes.has(scopeType)) throw new AdminError("Meta promotion scope must be CAMPAIGN, AD_SET, or AD.", {code: "VALIDATION", status: 400});
  if (!accountId || !externalCampaignId) throw new AdminError("Stable Meta account and campaign IDs are required.", {code: "VALIDATION", status: 400});
  if (scopeType !== "CAMPAIGN" && !externalAdSetId) throw new AdminError("Stable Meta Ad Set ID is required for AD_SET and AD scope.", {code: "VALIDATION", status: 400});
  if (scopeType === "AD" && !externalAdId) throw new AdminError("Stable Meta Ad ID is required for AD scope.", {code: "VALIDATION", status: 400});
  if (scopeType === "CAMPAIGN" && (externalAdSetId || externalAdId)) throw new AdminError("CAMPAIGN scope may not include child-scope IDs.", {code: "VALIDATION", status: 400});
  if (scopeType === "AD_SET" && externalAdId) throw new AdminError("AD_SET scope may not include an Ad ID.", {code: "VALIDATION", status: 400});
  const scopeIdentityKey = JSON.stringify(scopeType === "CAMPAIGN" ? [accountId, externalCampaignId] : scopeType === "AD_SET" ? [accountId, externalCampaignId, externalAdSetId] : [accountId, externalCampaignId, externalAdSetId, externalAdId]);
  return {scopeType, accountId, externalCampaignId, externalAdSetId, externalAdId, scopeIdentityKey};
}

function sameParent(a: CurrentLink, b: CurrentLink) { return a.accountId === b.accountId && a.externalCampaignId === b.externalCampaignId; }
function isDescendant(child: CurrentLink, parent: CurrentLink) {
  if (!sameParent(child, parent)) return false;
  if (scopeRank[child.scopeType as MetaPromotionScopeType] <= scopeRank[parent.scopeType as MetaPromotionScopeType]) return false;
  if (parent.scopeType === "CAMPAIGN") return true;
  return parent.scopeType === "AD_SET" && child.externalAdSetId === parent.externalAdSetId;
}

export function selectMostSpecificMetaPromotionLinks<T extends CurrentLink>(links: T[]) {
  return links.filter((candidate) => !links.some((other) => other.id !== candidate.id && isDescendant(other, candidate)));
}

export function metaPromotionScopeWhere(link: Pick<CurrentLink, "accountId" | "scopeType" | "externalCampaignId" | "externalAdSetId" | "externalAdId">) {
  return {
    accountId: link.accountId,
    campaignId: link.externalCampaignId,
    ...(link.scopeType === "AD_SET" || link.scopeType === "AD" ? {adSetId: link.externalAdSetId} : {}),
    ...(link.scopeType === "AD" ? {adId: link.externalAdId} : {}),
  };
}

export async function listMetaPromotionLinks(promotionCampaignId: string) {
  return prisma.metaPromotionLink.findMany({where: {promotionCampaignId}, include: {auditEvents: {orderBy: {createdAt: "asc"}}}, orderBy: [{createdAt: "asc"}, {id: "asc"}]});
}

export async function createMetaPromotionLink(input: ScopeInput & {promotionCampaignId: string; currentDisplayName?: string; evidence?: unknown; supersedesLinkId?: string; actor: Actor; now?: Date}) {
  const now = input.now ?? new Date();
  const scope = normalizeScope(input);
  if (!(await prisma.promotionCampaign.findUnique({where: {id: input.promotionCampaignId}, select: {id: true}}))) throw new AdminError("Promotion campaign was not found.", {code: "NOT_FOUND", status: 404});
  const prior = input.supersedesLinkId ? await prisma.metaPromotionLink.findFirst({where: {id: input.supersedesLinkId, promotionCampaignId: input.promotionCampaignId, supersededBy: null}}) : null;
  if (input.supersedesLinkId && !prior) throw new AdminError("The scoped Meta link being superseded was not found for this campaign.", {code: "NOT_FOUND", status: 404});
  const exactConfirmed = await prisma.metaPromotionLink.count({where: {scopeIdentityKey: scope.scopeIdentityKey, status: "CONFIRMED", supersededBy: null, promotionCampaignId: {not: input.promotionCampaignId}}});
  return prisma.$transaction(async (tx) => {
    const link = await tx.metaPromotionLink.create({data: {id: randomUUID(), promotionCampaignId: input.promotionCampaignId, ...scope, currentDisplayName: clean(input.currentDisplayName ?? "", 300), status: "SUGGESTED", associationMode: exactConfirmed > 0 ? "SHARED_EXTERNAL_SCOPE" : "EXCLUSIVE", monetaryAttribution: "UNALLOCATED", ambiguous: exactConfirmed > 0, evidence: JSON.stringify({...(typeof input.evidence === "object" && input.evidence ? input.evidence : {}), exactReverseAssociations: exactConfirmed, spendAllocation: "UNALLOCATED"}), actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), supersedesLinkId: prior?.id, createdAt: now, updatedAt: now}});
    await tx.metaPromotionLinkAuditEvent.create({data: {id: randomUUID(), linkId: link.id, action: prior ? "LINK_SCOPE_SUPERSEDED" : "LINK_SUGGESTED", previousValues: JSON.stringify(prior ? {linkId: prior.id, scopeType: prior.scopeType, scopeIdentityKey: prior.scopeIdentityKey, status: prior.status} : {}), newValues: JSON.stringify({...scope, exactReverseAssociations: exactConfirmed}), actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), createdAt: now}});
    return {...link, ambiguousReverseAssociation: exactConfirmed > 0};
  });
}

export async function transitionMetaPromotionLink(input: {promotionCampaignId: string; linkId: string; status: string; reason: string; confirmSharedScope?: boolean; actor: Actor; now?: Date}) {
  const now = input.now ?? new Date(); const status = input.status.trim().toUpperCase(); const reason = clean(input.reason, 1000);
  if (!statuses.has(status) || status === "SUGGESTED") throw new AdminError("Link status transition is invalid.", {code: "VALIDATION", status: 400});
  if (!reason) throw new AdminError("A link decision reason is required.", {code: "VALIDATION", status: 400});
  const prior = await prisma.metaPromotionLink.findFirst({where: {id: input.linkId, promotionCampaignId: input.promotionCampaignId}});
  if (!prior) throw new AdminError("Scoped Meta promotion link was not found for this campaign.", {code: "NOT_FOUND", status: 404});
  if (prior.status !== "SUGGESTED" && !(prior.status === "CONFIRMED" && status === "REVOKED")) throw new AdminError("Scoped Meta promotion link is no longer awaiting this decision.", {code: "CONFLICT", status: 409});
  if (status === "CONFIRMED" && await prisma.metaPromotionLink.count({where: {promotionCampaignId: prior.promotionCampaignId, scopeIdentityKey: prior.scopeIdentityKey, status: "CONFIRMED", supersededBy: null, id: {not: prior.id}}})) throw new AdminError("This internal campaign already has a current confirmed link for the same external Meta scope.", {code: "CONFLICT", status: 409});
  const reverseParentLinks = status === "CONFIRMED" ? await prisma.metaPromotionLink.findMany({where: {accountId: prior.accountId, externalCampaignId: prior.externalCampaignId, status: "CONFIRMED", supersededBy: null, promotionCampaignId: {not: prior.promotionCampaignId}}}) : [];
  const exactReverseLinks = reverseParentLinks.filter((link) => link.scopeIdentityKey === prior.scopeIdentityKey);
  if (exactReverseLinks.length && !input.confirmSharedScope) throw new AdminError("Confirming one external child scope for multiple internal campaigns requires explicit shared-scope confirmation.", {code: "SHARED_SCOPE_CONFIRMATION_REQUIRED", status: 409});
  const sharedExactMode = prior.scopeType === "CAMPAIGN" ? "SHARED_EXTERNAL_CAMPAIGN" : "SHARED_EXTERNAL_SCOPE";
  return prisma.$transaction(async (tx) => {
    for (const reverse of reverseParentLinks) {
      const exact = reverse.scopeIdentityKey === prior.scopeIdentityKey;
      const associationMode = exact ? (reverse.scopeType === "CAMPAIGN" ? "SHARED_EXTERNAL_CAMPAIGN" : "SHARED_EXTERNAL_SCOPE") : "SHARED_EXTERNAL_CAMPAIGN";
      const monetaryAttribution = exact ? "UNALLOCATED_SHARED" : reverse.monetaryAttribution === "UNALLOCATED" ? "EXTERNAL_SCOPE_ONLY" : reverse.monetaryAttribution;
      if (reverse.associationMode === associationMode && reverse.monetaryAttribution === monetaryAttribution && reverse.ambiguous === exact) continue;
      const replacementId = randomUUID();
      await tx.metaPromotionLink.create({data: {id: replacementId, promotionCampaignId: reverse.promotionCampaignId, accountId: reverse.accountId, scopeType: reverse.scopeType, externalCampaignId: reverse.externalCampaignId, externalAdSetId: reverse.externalAdSetId, externalAdId: reverse.externalAdId, scopeIdentityKey: reverse.scopeIdentityKey, currentDisplayName: reverse.currentDisplayName, status: "CONFIRMED", associationMode, monetaryAttribution, ambiguous: exact, evidence: JSON.stringify({sharedParentCampaign: true, sharedExternalScope: exact, spendAllocation: monetaryAttribution, supersededConfirmedLinkId: reverse.id}), reason: exact ? "External Meta scope is now confirmed against multiple internal campaigns." : "External Meta parent campaign contains multiple release-specific scopes.", actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), supersedesLinkId: reverse.id, createdAt: now, updatedAt: now}});
      await tx.metaPromotionLinkAuditEvent.create({data: {id: randomUUID(), linkId: replacementId, action: exact ? "LINK_MARKED_SHARED_SCOPE" : "LINK_MARKED_SHARED_PARENT", reason, previousValues: JSON.stringify({linkId: reverse.id, associationMode: reverse.associationMode, monetaryAttribution: reverse.monetaryAttribution}), newValues: JSON.stringify({associationMode, monetaryAttribution, ambiguous: exact}), actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), createdAt: now}});
    }
    const hasSharedParent = reverseParentLinks.length > 0;
    const exactShared = exactReverseLinks.length > 0;
    const associationMode = exactShared ? sharedExactMode : hasSharedParent ? "SHARED_EXTERNAL_CAMPAIGN" : "EXCLUSIVE";
    const monetaryAttribution = exactShared ? "UNALLOCATED_SHARED" : status === "CONFIRMED" ? "EXTERNAL_SCOPE_ONLY" : prior.monetaryAttribution;
    const link = await tx.metaPromotionLink.create({data: {id: randomUUID(), promotionCampaignId: prior.promotionCampaignId, accountId: prior.accountId, scopeType: prior.scopeType, externalCampaignId: prior.externalCampaignId, externalAdSetId: prior.externalAdSetId, externalAdId: prior.externalAdId, scopeIdentityKey: prior.scopeIdentityKey, currentDisplayName: prior.currentDisplayName, status, associationMode, monetaryAttribution, ambiguous: exactShared, evidence: JSON.stringify({sharedParentCampaign: hasSharedParent, sharedExternalScope: exactShared, reverseParentAssociations: reverseParentLinks.length, exactReverseAssociations: exactReverseLinks.length, spendAllocation: monetaryAttribution}), reason, actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), supersedesLinkId: prior.id, createdAt: now, updatedAt: now}});
    await tx.metaPromotionLinkAuditEvent.create({data: {id: randomUUID(), linkId: link.id, action: `LINK_${status}`, reason, previousValues: JSON.stringify({linkId: prior.id, status: prior.status, scopeType: prior.scopeType, scopeIdentityKey: prior.scopeIdentityKey}), newValues: JSON.stringify({status, associationMode, monetaryAttribution, ambiguous: exactShared}), actorId: input.actor.userId, actorUsername: clean(input.actor.username, 120), createdAt: now}});
    return {...link, ambiguousReverseAssociation: exactShared};
  });
}
