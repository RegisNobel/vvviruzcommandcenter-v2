import "server-only";

import {prisma} from "@/lib/db/prisma";
import {readNextReleasePlans} from "@/lib/repositories/releases";
import {getAssetStorageDriver, getBlobPath} from "@/lib/server/asset-storage";
import type {
  AdminOperatorQueueRecord,
  OperationalHealthCategory,
  OperationalHealthIssueRecord,
  OperationalHealthSeverity
} from "@/lib/types";
import {createId, fileNameFromPath} from "@/lib/utils";

const BACKUP_WARNING_AGE_MS = 36 * 60 * 60 * 1000;
const BACKUP_CRITICAL_AGE_MS = 72 * 60 * 60 * 1000;
const STALLED_OPERATION_AGE_MS = 45 * 60 * 1000;
const EMAIL_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

type HealthCandidate = {
  checkKey: string;
  category: OperationalHealthCategory;
  severity: OperationalHealthSeverity;
  title: string;
  message: string;
  actionPath: string;
  entityType?: string;
  entityId?: string;
};

function toIssueRecord(issue: {
  id: string;
  checkKey: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  actionPath: string;
  entityType: string;
  entityId: string;
  detectedAt: Date;
  updatedAt: Date;
}): OperationalHealthIssueRecord {
  return {
    id: issue.id,
    check_key: issue.checkKey,
    category: issue.category as OperationalHealthCategory,
    severity: issue.severity as OperationalHealthSeverity,
    title: issue.title,
    message: issue.message,
    action_path: issue.actionPath,
    entity_type: issue.entityType,
    entity_id: issue.entityId,
    detected_at: issue.detectedAt.toISOString(),
    updated_at: issue.updatedAt.toISOString()
  };
}

function isValidPublicUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getBackupAgeSeverity(ageMs: number): OperationalHealthSeverity {
  return ageMs >= BACKUP_CRITICAL_AGE_MS ? "critical" : "warning";
}

async function collectBackupCandidates(now: Date): Promise<HealthCandidate[]> {
  const runs = await prisma.backupRun.findMany({
    orderBy: {startedAt: "desc"},
    take: 40
  });
  const candidates: HealthCandidate[] = [];

  for (const type of ["database_snapshot", "asset_manifest"] as const) {
    const latest = runs.find((run) => run.type === type);
    const latestSuccess = runs.find((run) => run.type === type && run.status === "success");
    const label = type === "database_snapshot" ? "Database backup" : "Asset manifest backup";
    const latestFailed =
      latest?.status === "failed" &&
      (!latestSuccess || latest.startedAt > latestSuccess.startedAt);
    const latestStalled =
      latest?.status === "running" &&
      now.getTime() - latest.startedAt.getTime() >= STALLED_OPERATION_AGE_MS;
    const latestInProgress = latest?.status === "running" && !latestStalled;

    if (latestFailed) {
      candidates.push({
        actionPath: "/admin/backups",
        category: "scheduled-operations",
        checkKey: `scheduled-operation:failed:${type}`,
        message: latest.errorMessage?.trim() || `${label} failed during its latest scheduled run.`,
        severity: "critical",
        title: `Scheduled ${label.toLowerCase()} failed`
      });
    } else if (latestStalled) {
      candidates.push({
        actionPath: "/admin/backups",
        category: "scheduled-operations",
        checkKey: `scheduled-operation:stalled:${type}`,
        message: `${label} has remained in progress for more than 45 minutes.`,
        severity: "critical",
        title: `Scheduled ${label.toLowerCase()} is stalled`
      });
    } else if (!latestSuccess && !latestInProgress) {
      candidates.push({
        actionPath: "/admin/backups",
        category: "backups",
        checkKey: `backup:no-success:${type}`,
        message: `${label} has no recorded successful run. Run and verify a backup before relying on restore coverage.`,
        severity: "critical",
        title: `${label} has not succeeded`
      });
    } else if (latestSuccess && !latestInProgress) {
      const ageMs = now.getTime() - latestSuccess.startedAt.getTime();

      if (ageMs >= BACKUP_WARNING_AGE_MS) {
        candidates.push({
          actionPath: "/admin/backups",
          category: "backups",
          checkKey: `backup:stale:${type}`,
          message: `${label} is ${Math.floor(ageMs / (60 * 60 * 1000))} hours old. The daily backup window may have been missed.`,
          severity: getBackupAgeSeverity(ageMs),
          title: `${label} is stale`
        });
      }
    }
  }

  return candidates;
}

type PublicReleaseHealthRow = Awaited<ReturnType<typeof readPublicReleaseHealthRows>>[number];

async function readPublicReleaseHealthRows() {
  return prisma.release.findMany({
    where: {isPublished: true},
    select: {
      id: true,
      title: true,
      slug: true,
      coverArtFileName: true,
      coverArtPath: true,
      coverArtUrl: true,
      conceptDetails: true,
      publicDescription: true,
      spotifyUrl: true,
      appleMusicUrl: true,
      youtubeUrl: true,
      streamingLinks: {
        select: {platform: true, url: true}
      }
    }
  });
}

function getStreamingValues(release: PublicReleaseHealthRow) {
  const values = [
    ["Spotify", release.spotifyUrl],
    ["Apple Music", release.appleMusicUrl],
    ["YouTube", release.youtubeUrl],
    ...release.streamingLinks.map((link) => [link.platform, link.url] as [string, string])
  ] as Array<[string, string]>;

  return values.filter(([, value]) => value.trim());
}

function collectPublicReleaseCandidates(releases: PublicReleaseHealthRow[]): HealthCandidate[] {
  return releases.flatMap((release) => {
    const candidates: HealthCandidate[] = [];
    const missing: string[] = [];
    const streamingValues = getStreamingValues(release);

    if (!release.slug.trim()) missing.push("public URL");
    if (!(release.coverArtFileName || release.coverArtPath || release.coverArtUrl)) missing.push("cover art");
    if (!(release.publicDescription.trim() || release.conceptDetails.trim())) missing.push("public summary");
    if (streamingValues.length === 0) missing.push("streaming link");

    if (missing.length > 0) {
      candidates.push({
        actionPath: `/admin/releases/${release.id}`,
        category: "public-site",
        checkKey: `public-essential:${release.id}`,
        entityId: release.id,
        entityType: "release",
        message: `${release.title} is publicly visible but missing ${missing.join(", ")}.`,
        severity: missing.includes("cover art") || missing.includes("public URL") ? "critical" : "warning",
        title: "Published release needs attention"
      });
    }

    const invalidPlatforms = streamingValues
      .filter(([, value]) => !isValidPublicUrl(value))
      .map(([platform]) => platform);

    if (invalidPlatforms.length > 0) {
      candidates.push({
        actionPath: `/admin/releases/${release.id}`,
        category: "streaming",
        checkKey: `streaming-url:${release.id}`,
        entityId: release.id,
        entityType: "release",
        message: `${release.title} has malformed ${invalidPlatforms.join(", ")} URL${invalidPlatforms.length === 1 ? "" : "s"}. Only http:// and https:// destinations are supported.`,
        severity: "critical",
        title: "Streaming URL is invalid"
      });
    }

    return candidates;
  });
}

async function collectAssetCandidates(releases: PublicReleaseHealthRow[]): Promise<HealthCandidate[]> {
  const driver = getAssetStorageDriver();

  if (process.env.VERCEL && driver !== "vercel-blob") {
    return [{
      actionPath: "/admin/site",
      category: "assets",
      checkKey: "assets:durable-storage-disabled",
      message: "The production deployment is not configured to use Vercel Blob. Uploaded files may not survive deployments.",
      severity: "critical",
      title: "Durable asset storage is disabled"
    }];
  }

  if (driver !== "vercel-blob") {
    return [];
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return [{
      actionPath: "/admin/backups",
      category: "assets",
      checkKey: "assets:blob-token-missing",
      message: "Vercel Blob is selected, but BLOB_READ_WRITE_TOKEN is unavailable to the runtime.",
      severity: "critical",
      title: "Blob access is not configured"
    }];
  }

  try {
    const {list} = await import("@vercel/blob");
    const prefix = process.env.BLOB_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "vvviruz";
    const pathnames = new Set<string>();
    let cursor: string | undefined;

    do {
      const result = await list({cursor, limit: 1000, prefix: `${prefix}/`});
      result.blobs.forEach((blob) => pathnames.add(blob.pathname));
      cursor = result.cursor;
    } while (cursor);

    return releases.flatMap((release) => {
      const reference = release.coverArtFileName || release.coverArtPath || release.coverArtUrl || "";
      const fileName = fileNameFromPath(reference);

      if (!fileName || pathnames.has(getBlobPath("cover", fileName))) {
        return [];
      }

      return [{
        actionPath: `/admin/releases/${release.id}`,
        category: "assets" as const,
        checkKey: `assets:missing-cover:${release.id}`,
        entityId: release.id,
        entityType: "release",
        message: `${release.title} references ${fileName}, but that cover was not found in the configured Blob store.`,
        severity: "critical" as const,
        title: "Published cover is missing from Blob"
      }];
    });
  } catch (error) {
    return [{
      actionPath: "/admin/backups",
      category: "assets",
      checkKey: "assets:blob-inventory-failed",
      message: error instanceof Error ? error.message.slice(0, 500) : "Blob inventory could not be read.",
      severity: "critical",
      title: "Blob assets could not be verified"
    }];
  }
}

async function collectEmailCandidates(now: Date): Promise<HealthCandidate[]> {
  const failureWindowStart = new Date(now.getTime() - EMAIL_FAILURE_WINDOW_MS);
  const stalledBefore = new Date(now.getTime() - STALLED_OPERATION_AGE_MS);
  const [failedLogs, failedCampaigns, stalledCampaigns] = await Promise.all([
    prisma.emailSendLog.findMany({
      where: {status: "failed", createdAt: {gte: failureWindowStart}},
      orderBy: {createdAt: "desc"},
      take: 50
    }),
    prisma.emailCampaign.findMany({
      where: {status: "failed", updatedAt: {gte: failureWindowStart}},
      orderBy: {updatedAt: "desc"},
      take: 20
    }),
    prisma.emailCampaign.findMany({
      where: {status: "sending", updatedAt: {lt: stalledBefore}},
      orderBy: {updatedAt: "asc"},
      take: 20
    })
  ]);
  const candidates: HealthCandidate[] = [];

  if (failedLogs.length > 0 || failedCampaigns.length > 0) {
    candidates.push({
      actionPath: "/admin/audience",
      category: "email",
      checkKey: "email:recent-failures",
      message: `${failedLogs.length} recipient send${failedLogs.length === 1 ? "" : "s"} and ${failedCampaigns.length} campaign${failedCampaigns.length === 1 ? "" : "s"} failed in the last 24 hours. Review the delivery log before the next send.`,
      severity: failedLogs.length >= 5 || failedCampaigns.length > 0 ? "critical" : "warning",
      title: "Recent email delivery failures"
    });
  }

  if (stalledCampaigns.length > 0) {
    candidates.push({
      actionPath: "/admin/audience",
      category: "email",
      checkKey: "email:stalled-sends",
      message: `${stalledCampaigns.length} campaign${stalledCampaigns.length === 1 ? " has" : "s have"} remained in Sending for more than 45 minutes.`,
      severity: "critical",
      title: "Email campaign send is stalled"
    });
  }

  return candidates;
}

async function collectArtistIntakeNotificationCandidates(): Promise<
  HealthCandidate[]
> {
  const intakes = await prisma.artistIntake.findMany({
    where: {
      submissionNotificationStatus: {in: ["FAILED", "NOT_CONFIGURED"]},
      status: {in: ["SUBMITTED", "REVIEWED"]}
    },
    select: {
      id: true,
      artistName: true,
      submissionNotificationStatus: true,
      submissionNotificationError: true
    },
    take: 20,
    orderBy: {updatedAt: "desc"}
  });

  return intakes.map((intake) => ({
    actionPath: `/admin/artists/intake/${intake.id}`,
    category: "email" as const,
    checkKey: `artist-intake-notification:${intake.id}`,
    entityId: intake.id,
    entityType: "artist-intake",
    message:
      intake.submissionNotificationError ||
      `${intake.artistName}'s submission notification was not delivered.`,
    severity: "warning" as const,
    title:
      intake.submissionNotificationStatus === "NOT_CONFIGURED"
        ? "Artist intake notification is not configured"
        : "Artist intake notification failed"
  }));
}

export async function runOperationalHealthChecks() {
  const now = new Date();
  const releases = await readPublicReleaseHealthRows();
  const candidateGroups = await Promise.all([
    collectBackupCandidates(now),
    collectAssetCandidates(releases),
    collectEmailCandidates(now),
    collectArtistIntakeNotificationCandidates()
  ]);
  const candidates = [
    ...candidateGroups.flat(),
    ...collectPublicReleaseCandidates(releases)
  ];
  const currentIssues = await prisma.operationalHealthIssue.findMany();
  const currentByKey = new Map(currentIssues.map((issue) => [issue.checkKey, issue]));
  const activeKeys = candidates.map((candidate) => candidate.checkKey);

  await prisma.$transaction(async (tx) => {
    await tx.operationalHealthIssue.deleteMany({
      where: activeKeys.length > 0 ? {checkKey: {notIn: activeKeys}} : undefined
    });

    for (const candidate of candidates) {
      const existing = currentByKey.get(candidate.checkKey);

      await tx.operationalHealthIssue.upsert({
        where: {checkKey: candidate.checkKey},
        create: {
          id: createId(),
          ...candidate,
          entityId: candidate.entityId ?? "",
          entityType: candidate.entityType ?? "",
          detectedAt: now,
          updatedAt: now
        },
        update: {
          category: candidate.category,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          actionPath: candidate.actionPath,
          entityId: candidate.entityId ?? "",
          entityType: candidate.entityType ?? "",
          detectedAt: existing?.detectedAt ?? now,
          updatedAt: now
        }
      });
    }
  });

  return {
    checkedAt: now.toISOString(),
    criticalCount: candidates.filter((candidate) => candidate.severity === "critical").length,
    issueCount: candidates.length,
    warningCount: candidates.filter((candidate) => candidate.severity === "warning").length
  };
}

export async function readOperationalHealthIssues() {
  const issues = await prisma.operationalHealthIssue.findMany({
    orderBy: {updatedAt: "desc"}
  });

  return issues
    .map(toIssueRecord)
    .sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "critical" ? -1 : 1;
      return right.updated_at.localeCompare(left.updated_at);
    });
}

function formatDecision(value: string) {
  return value.trim().replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function readAdminOperatorQueue(): Promise<AdminOperatorQueueRecord> {
  const [nextPlans, issues, batches, latestDecision, latestBackup] = await Promise.all([
    readNextReleasePlans(1),
    readOperationalHealthIssues(),
    prisma.adImportBatch.findMany({
      include: {
        learnings: {select: {reviewedAt: true}},
        release: {select: {title: true}}
      },
      orderBy: {createdAt: "desc"},
      take: 40
    }),
    prisma.adCampaignLearning.findFirst({
      where: {reviewedAt: {not: null}},
      include: {
        importBatch: {select: {id: true}},
        release: {select: {title: true}}
      },
      orderBy: {reviewedAt: "desc"}
    }),
    prisma.backupRun.findFirst({
      where: {type: "database_snapshot", status: "success"},
      orderBy: {startedAt: "desc"}
    })
  ]);
  const nextRelease = nextPlans[0] ?? null;
  const activeBatch =
    batches.find(
      (batch) =>
        batch.releaseId === nextRelease?.id && batch.learnings.every((learning) => !learning.reviewedAt)
    ) ?? batches.find((batch) => batch.learnings.every((learning) => !learning.reviewedAt)) ?? null;
  const backupIssue = issues.find((issue) => issue.category === "backups" || issue.category === "scheduled-operations");
  const backupAgeMs = latestBackup ? Date.now() - latestBackup.startedAt.getTime() : null;
  const backupStatus = backupIssue?.severity ?? (backupAgeMs === null ? "critical" : backupAgeMs >= BACKUP_WARNING_AGE_MS ? "warning" : "healthy");

  return {
    next_release: nextRelease
      ? {
          id: nextRelease.id,
          title: nextRelease.title,
          release_date: nextRelease.release_date,
          stage: nextRelease.status,
          action_path: `/admin/releases/${nextRelease.id}`
        }
      : null,
    primary_blocker: nextRelease
      ? {
          action_path: `/admin/releases/${nextRelease.id}`,
          detail: nextRelease.blockers[0] ?? nextRelease.next_action,
          label: nextRelease.blockers.length > 0 ? "Blocked" : "Next action"
        }
      : {
          action_path: "/admin/releases/new",
          detail: "Create or schedule the next release.",
          label: "No upcoming release"
        },
    active_campaign: activeBatch
      ? {
          action_path: `/admin/ad-lab/${activeBatch.id}`,
          batch_id: activeBatch.id,
          label: activeBatch.name.trim() || "Latest Meta snapshot",
          release_title: activeBatch.release?.title ?? "Unlinked campaign"
        }
      : null,
    latest_decision: latestDecision?.reviewedAt
      ? {
          action_path: latestDecision.releaseId
            ? `/admin/releases/${latestDecision.releaseId}#promo`
            : `/admin/ad-lab/${latestDecision.importBatch.id}`,
          label: formatDecision(latestDecision.finalDecision || latestDecision.decision),
          release_title: latestDecision.release?.title ?? "Unlinked campaign",
          reviewed_at: latestDecision.reviewedAt.toISOString()
        }
      : null,
    backup_health: {
      action_path: "/admin/backups",
      detail: latestBackup
        ? `Last successful database backup ${latestBackup.startedAt.toLocaleDateString("en-US", {month: "short", day: "numeric"})}.`
        : "No successful database backup is recorded.",
      label: backupStatus === "healthy" ? "Healthy" : backupStatus === "critical" ? "Critical" : "Needs review",
      status: backupStatus
    },
    critical_issue: issues.find((issue) => issue.severity === "critical") ?? issues[0] ?? null,
    issue_count: issues.length
  };
}
