import "server-only";

import {randomUUID} from "node:crypto";

import {prisma} from "@/lib/db/prisma";
import {AdminError} from "@/lib/server/admin-error-response";

export type MetaAccountTimezoneOrigin = "META_SOURCE" | "USER_CONFIRMED";
type MetaTimezoneActor = {userId: string; username: string};

function cleanAccountId(value: string) {
  const accountId = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  if (!accountId) throw new AdminError("Meta Account ID is required.", {code: "VALIDATION", status: 400});
  return accountId;
}

function ianaTimezone(value: string) {
  const timezone = value.trim().slice(0, 100);
  try {
    new Intl.DateTimeFormat("en-US", {timeZone: timezone}).format(new Date());
  } catch {
    throw new AdminError("Enter a valid IANA timezone such as America/New_York.", {code: "VALIDATION", status: 400});
  }
  return timezone;
}

export async function readCurrentMetaAccountTimezone(accountId: string) {
  const normalizedAccountId = cleanAccountId(accountId);
  return prisma.metaAccountTimezoneResolution.findFirst({
    where: {accountId: normalizedAccountId, resolutionState: "CURRENT"},
    orderBy: [{confirmedAt: "desc"}, {id: "desc"}]
  });
}

export async function confirmMetaAccountTimezone(input: {
  accountId: string;
  timezone: string;
  sourceOrigin: MetaAccountTimezoneOrigin;
  actor: MetaTimezoneActor;
  replaceCurrent?: boolean;
  reason?: string;
  now?: Date;
}) {
  const accountId = cleanAccountId(input.accountId); const timezone = ianaTimezone(input.timezone); const now = input.now ?? new Date();
  const reason = (input.reason ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 1000);
  return prisma.$transaction(async (tx) => {
    const current = await tx.metaAccountTimezoneResolution.findFirst({where: {accountId, resolutionState: "CURRENT"}, orderBy: [{confirmedAt: "desc"}, {id: "desc"}]});
    if (current?.ianaTimezone === timezone && current.sourceOrigin === input.sourceOrigin) return current;
    if (current && current.ianaTimezone !== timezone && (!input.replaceCurrent || !reason)) {
      throw new AdminError("The proposed timezone conflicts with the reviewed account timezone. Explicit replacement and an audit reason are required.", {code: "TIMEZONE_CONFLICT_REVIEW_REQUIRED", status: 409});
    }
    if (current) await tx.metaAccountTimezoneResolution.update({where: {id: current.id}, data: {resolutionState: "SUPERSEDED"}});
    return tx.metaAccountTimezoneResolution.create({data: {
      id: randomUUID(), accountId, ianaTimezone: timezone, sourceOrigin: input.sourceOrigin, resolutionState: "CURRENT",
      supersedesResolutionId: current?.id ?? null, confirmedAt: now, confirmedById: input.actor.userId,
      confirmedByUsername: input.actor.username.slice(0, 120), createdAt: now
    }});
  });
}
