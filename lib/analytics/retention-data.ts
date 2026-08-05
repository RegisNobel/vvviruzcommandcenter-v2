import "server-only";

import {prisma} from "@/lib/db/prisma";
import {CANONICAL_ANALYTICS_ARTIST_ID, readCurrentAnalyticsDataset} from "@/lib/repositories/analytics-imports";
import {AdminError} from "@/lib/server/admin-error-response";

import {addDays, datesInclusive} from "./retention-calculations";
import {calculateRetentionAnalysis} from "./retention-engine";
import {calculateTrackPersistence} from "./track-persistence";
import type {
  AudienceObservationInput,
  ImportProvenance,
  MappingResolutionEvidence,
  RetentionAnalysisResult,
  RetentionCalculationInput,
  RetentionOverlap,
  TrackObservationInput,
  TrackPersistenceResult
} from "./retention-types";

type CampaignChoice = {
  id: string;
  name: string;
  platform: string;
  status: string;
  confirmedIntervalCount: number;
};

export type ReleaseRetentionAnalysisContext = {
  analysis: RetentionAnalysisResult;
  release: {id: string; title: string; releaseDate: string; artistId: string};
  campaign: {id: string; name: string; platform: string; status: string};
  audienceObservations: AudienceObservationInput[];
  trackObservations: TrackObservationInput[];
  timelineEvents: Array<{
    id: string;
    eventType: string;
    eventDate: string;
    timezone: string;
    title: string;
    source: string;
  }>;
};

export type ReleaseTrackPersistenceContext = {
  release: {id: string; title: string; releaseDate: string; artistId: string};
  trackPersistence: TrackPersistenceResult;
  trackObservations: TrackObservationInput[];
};

export class RetentionCampaignRequiredError extends AdminError {
  readonly campaigns: CampaignChoice[];

  constructor(campaigns: CampaignChoice[]) {
    super(
      campaigns.length
        ? "Select one campaign for this release analysis."
        : "This release has no campaign available for retention analysis.",
      {code: "RETENTION_CAMPAIGN_REQUIRED", status: 409}
    );
    this.name = "RetentionCampaignRequiredError";
    this.campaigns = campaigns;
  }
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function readRetentionRelease(releaseId: string, now: Date) {
  const release = await prisma.release.findUnique({
    where: {id: releaseId},
    select: {id: true, title: true, releaseDate: true, primaryArtistProfileId: true, catalogScope: true}
  });
  if (!release) throw new AdminError("Release was not found.", {code: "RETENTION_RELEASE_NOT_FOUND", status: 404});
  const artistId = release.primaryArtistProfileId ?? (release.catalogScope === "VVVIRUZ" ? CANONICAL_ANALYTICS_ARTIST_ID : null);
  if (!artistId) throw new AdminError("Release ownership cannot be resolved to an analytics artist.", {code: "RETENTION_DATA_UNAVAILABLE", status: 409});
  if (!release.releaseDate) throw new AdminError("A confirmed release date is required for retention windows.", {code: "RETENTION_DATA_UNAVAILABLE", status: 409});
  const releaseDate = dateOnly(release.releaseDate);
  if (releaseDate > dateOnly(now)) throw new AdminError("Retention cannot be calculated before the release date.", {code: "RETENTION_DATA_UNAVAILABLE", status: 409});
  return {...release, artistId, releaseDate};
}

export async function readReleaseTrackPersistenceContext(
  releaseId: string,
  options: {now?: Date; currentDataset?: Awaited<ReturnType<typeof readCurrentAnalyticsDataset>>} = {}
): Promise<ReleaseTrackPersistenceContext> {
  const now = options.now ?? new Date();
  const release = await readRetentionRelease(releaseId, now);
  const dataset = options.currentDataset ?? await readCurrentAnalyticsDataset(release.artistId);
  const importIds = dataset.imports.map(({id}) => id);
  const rawCurrentTrackRows = await prisma.trackMetricObservation.findMany({
    where: {importId: {in: importIds}, releaseId},
    select: {importId: true, spotifyTrackId: true}
  });
  const trackObservations = dataset.trackMetricObservations
    .filter((row) => row.releaseId === releaseId)
    .map((row) => ({date: dateOnly(row.metricDate), streams: row.streams, importId: row.importId, spotifyTrackId: row.spotifyTrackId}))
    .sort((left, right) => left.date.localeCompare(right.date));
  const trackIds = new Set(rawCurrentTrackRows.flatMap((row) => row.spotifyTrackId ? [row.spotifyTrackId] : []));
  const trackImportIds = new Set(rawCurrentTrackRows.map((row) => row.importId));
  const conflictingTrackTimelines = trackIds.size > 1;
  const incompleteIdentity = rawCurrentTrackRows.some((row) => !row.spotifyTrackId) && (trackImportIds.size > 1 || trackIds.size > 0);
  return {
    release: {id: release.id, title: release.title, releaseDate: release.releaseDate, artistId: release.artistId},
    trackPersistence: calculateTrackPersistence(trackObservations, release.releaseDate, {conflictingTimelines: conflictingTrackTimelines, incompleteIdentity}),
    trackObservations
  };
}

function safeObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function reconciliationWarnings(importId: string, summary: Record<string, unknown>) {
  const warnings: Array<{importId: string; key: string; severity: string; message: string}> = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (
      (item.severity === "WARNING" || item.severity === "HIGH") &&
      typeof item.key === "string" &&
      typeof item.message === "string"
    ) {
      warnings.push({
        importId,
        key: item.key,
        severity: item.severity,
        message: item.message
      });
    }
    Object.values(item).forEach(visit);
  };
  visit(summary.reconciliation);
  return warnings;
}

function inclusiveOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string | null
) {
  return leftStart <= (rightEnd ?? "9999-12-31") && rightStart <= leftEnd;
}

function affectedWindows(
  startDate: string,
  endDate: string | null,
  windows: Array<{name: RetentionOverlap["affectedWindow"]; dates: string[]}>
) {
  return windows.flatMap(({name, dates}) => {
    if (!dates.length || !inclusiveOverlap(dates[0], dates.at(-1)!, startDate, endDate)) return [];
    return [name];
  });
}

function campaignChoices(
  campaigns: Array<{
    id: string;
    name: string;
    platform: string;
    status: string;
    activeIntervals: Array<{id: string}>;
  }>
) {
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform,
    status: campaign.status,
    confirmedIntervalCount: campaign.activeIntervals.length
  }));
}

export async function readReleaseRetentionAnalysisContext(
  releaseId: string,
  options: {
    campaignId?: string | null;
    now?: Date;
    currentDataset?: Awaited<ReturnType<typeof readCurrentAnalyticsDataset>>;
  } = {}
) {
  const now = options.now ?? new Date();
  const release = await readRetentionRelease(releaseId, now);
  const artistId = release.artistId;
  const releaseDate = release.releaseDate;

  const availableCampaigns = await prisma.promotionCampaign.findMany({
    where: {releaseId, status: {not: "ARCHIVED"}},
    orderBy: [{updatedAt: "desc"}, {id: "asc"}],
    select: {
      id: true,
      name: true,
      platform: true,
      status: true,
      artistProfileId: true,
      activeIntervals: {
        where: {confirmationStatus: "CONFIRMED", supersededBy: null},
        orderBy: [{activeStartDate: "asc"}, {id: "asc"}],
        select: {
          id: true,
          activeStartDate: true,
          activeEndDate: true,
          timezone: true,
          sourceType: true
        }
      }
    }
  });
  let selected = options.campaignId
    ? availableCampaigns.find((campaign) => campaign.id === options.campaignId)
    : availableCampaigns.length === 1
      ? availableCampaigns[0]
      : null;
  if (options.campaignId && !selected) {
    const campaign = await prisma.promotionCampaign.findUnique({
      where: {id: options.campaignId},
      select: {releaseId: true}
    });
    throw new AdminError(
      campaign
        ? "The selected campaign belongs to a different release."
        : "Campaign was not found.",
      {
        code: campaign
          ? "RETENTION_CAMPAIGN_RELEASE_MISMATCH"
          : "RETENTION_CAMPAIGN_NOT_FOUND",
        status: campaign ? 409 : 404
      }
    );
  }
  if (!selected) throw new RetentionCampaignRequiredError(campaignChoices(availableCampaigns));
  if (selected.artistProfileId !== artistId) {
    throw new AdminError("Campaign and release ownership do not match.", {
      code: "RETENTION_CAMPAIGN_RELEASE_MISMATCH",
      status: 409
    });
  }
  if (!selected.activeIntervals.length) {
    throw new AdminError("The selected campaign has no current confirmed active interval.", {
      code: "RETENTION_DATA_UNAVAILABLE",
      status: 409
    });
  }

  const dataset = options.currentDataset ?? await readCurrentAnalyticsDataset(artistId);
  if (!dataset.artistMetricObservations.length) {
    throw new AdminError("No current artist audience timeline is available.", {
      code: "RETENTION_DATA_UNAVAILABLE",
      status: 409
    });
  }
  const importIds = dataset.imports.map(({id}) => id);
  const [mappingRows, rawCurrentTrackRows, timelineEvents] = await Promise.all([
    prisma.analyticsImportRow.findMany({
      where: {importId: {in: importIds}},
      orderBy: [{importId: "asc"}, {sourceRowNumber: "asc"}],
      select: {
        id: true,
        importId: true,
        rowIdentityKey: true,
        mappingStatus: true,
        confirmedReleaseId: true,
        mappingConfidence: true,
        mappingVersion: true,
        appliedAlias: {select: {status: true}}
      }
    }),
    prisma.trackMetricObservation.findMany({
      where: {importId: {in: importIds}, releaseId},
      select: {importId: true, spotifyTrackId: true}
    }),
    prisma.campaignTimelineEvent.findMany({
      where: {
        releaseId,
        campaignId: selected.id,
        confirmationStatus: "CONFIRMED",
        revokedAt: null
      },
      orderBy: [{eventDate: "asc"}, {createdAt: "asc"}, {id: "asc"}],
      select: {
        id: true,
        eventType: true,
        eventDate: true,
        timezone: true,
        title: true,
        source: true
      }
    })
  ]);
  const identities = new Map<string, Set<string>>();
  for (const row of mappingRows) {
    if (row.mappingStatus !== "CONFIRMED" || !row.confirmedReleaseId) continue;
    const releases = identities.get(row.rowIdentityKey) ?? new Set<string>();
    releases.add(row.confirmedReleaseId);
    identities.set(row.rowIdentityKey, releases);
  }
  const ambiguousReleaseMapping = [...identities.values()].some(
    (values) => values.has(releaseId) && values.size > 1
  );
  const mappingResolution: MappingResolutionEvidence[] = mappingRows.flatMap((row) =>
    row.confirmedReleaseId === releaseId || identities.get(row.rowIdentityKey)?.has(releaseId)
      ? [
          {
            rowId: row.id,
            importId: row.importId,
            rowIdentityKey: row.rowIdentityKey,
            mappingStatus: row.mappingStatus,
            confirmedReleaseId: row.confirmedReleaseId,
            mappingConfidence: row.mappingConfidence,
            mappingVersion: row.mappingVersion,
            appliedAliasStatus: row.appliedAlias?.status ?? null
          }
        ]
      : []
  );

  const audienceObservations = dataset.artistMetricObservations
    .map((row) => ({
      date: dateOnly(row.metricDate),
      listeners: row.listeners,
      monthlyListeners: row.monthlyListeners,
      monthlyActiveListeners: row.monthlyActiveListeners,
      streams: row.streams,
      playlistAdds: row.playlistAdds,
      saves: row.saves,
      followers: row.followers,
      importId: row.importId
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const trackObservations = dataset.trackMetricObservations
    .filter((row) => row.releaseId === releaseId)
    .map((row) => ({
      date: dateOnly(row.metricDate),
      streams: row.streams,
      importId: row.importId,
      spotifyTrackId: row.spotifyTrackId
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const trackIds = new Set(
    rawCurrentTrackRows.flatMap((row) => (row.spotifyTrackId ? [row.spotifyTrackId] : []))
  );
  const trackImportIds = new Set(rawCurrentTrackRows.map((row) => row.importId));
  const conflictingTrackTimelines = trackIds.size > 1;
  const incompleteTrackIdentity =
    rawCurrentTrackRows.some((row) => !row.spotifyTrackId) &&
    (trackImportIds.size > 1 || trackIds.size > 0);

  const confirmedCampaignIntervals = selected.activeIntervals.map((interval) => ({
    id: interval.id,
    startDate: dateOnly(interval.activeStartDate),
    endDate: interval.activeEndDate ? dateOnly(interval.activeEndDate) : null,
    timezone: interval.timezone,
    sourceType: interval.sourceType
  }));
  const campaignDates = [
    ...new Set(
      confirmedCampaignIntervals.flatMap((interval) =>
        interval.endDate
          ? datesInclusive(interval.startDate, interval.endDate)
          : datesInclusive(interval.startDate, audienceObservations.at(-1)!.date)
      )
    )
  ].sort();
  const closedEnd = confirmedCampaignIntervals.some((interval) => !interval.endDate)
    ? null
    : confirmedCampaignIntervals.flatMap((interval) => (interval.endDate ? [interval.endDate] : [])).sort().at(-1) ?? null;
  const windows = [
    {
      name: "BASELINE" as const,
      dates: datesInclusive(addDays(releaseDate, -28), addDays(releaseDate, -1))
    },
    {name: "CAMPAIGN" as const, dates: campaignDates},
    {
      name: "POST_CAMPAIGN" as const,
      dates: closedEnd ? datesInclusive(addDays(closedEnd, 14), addDays(closedEnd, 28)) : []
    }
  ];
  const otherReleases = await prisma.release.findMany({
    where: {id: {not: releaseId}, releaseDate: {not: null}},
    select: {id: true, title: true, releaseDate: true}
  });
  const otherIntervals = await prisma.campaignActiveInterval.findMany({
    where: {
      campaignId: {not: selected.id},
      confirmationStatus: "CONFIRMED",
      supersededBy: null,
      campaign: {status: {not: "ARCHIVED"}}
    },
    include: {
      campaign: {
        select: {id: true, name: true, releaseId: true, release: {select: {title: true}}}
      }
    }
  });
  const overlaps: RetentionOverlap[] = [];
  for (const releaseItem of otherReleases) {
    const eventDate = dateOnly(releaseItem.releaseDate!);
    for (const window of windows) {
      if (window.dates.includes(eventDate)) {
        overlaps.push({
          type: "OTHER_RELEASE_PUBLISHED",
          releaseId: releaseItem.id,
          releaseTitle: releaseItem.title,
          eventDate,
          affectedWindow: window.name
        });
      }
    }
  }
  for (const interval of otherIntervals) {
    const startDate = dateOnly(interval.activeStartDate);
    const endDate = interval.activeEndDate ? dateOnly(interval.activeEndDate) : null;
    for (const affectedWindow of affectedWindows(startDate, endDate, windows)) {
      overlaps.push({
        type:
          interval.campaign.releaseId === releaseId
            ? "SAME_RELEASE_CAMPAIGN"
            : "DIFFERENT_RELEASE_CAMPAIGN",
        releaseId: interval.campaign.releaseId,
        releaseTitle: interval.campaign.release.title,
        campaignId: interval.campaign.id,
        campaignName: interval.campaign.name,
        startDate,
        endDate,
        affectedWindow
      });
    }
  }

  const contributingImportIds = new Set([
    ...audienceObservations.map((row) => row.importId),
    ...trackObservations.map((row) => row.importId),
    ...mappingResolution.map((row) => row.importId)
  ]);
  const contributingImports = dataset.imports.filter((item) => contributingImportIds.has(item.id));
  const inputImports: ImportProvenance[] = contributingImports.map((item) => {
    const summary = safeObject(item.validationSummary);
    return {
      importId: item.id,
      importType: item.importType,
      parserVersion: typeof summary.parserVersion === "string" ? summary.parserVersion : null,
      normalizationVersion: item.normalizationVersion,
      acceptedAt: item.acceptedAt?.toISOString() ?? null,
      periodDatesUserConfirmed: item.periodDatesUserConfirmed
    };
  });
  const calculationInput: RetentionCalculationInput = {
    artistId,
    releaseId,
    campaignId: selected.id,
    releaseDate,
    confirmedCampaignIntervals,
    audienceObservations,
    trackObservations,
    overlaps,
    inputImports,
    mappingResolution,
    reconciliationWarnings: contributingImports.flatMap((item) =>
      reconciliationWarnings(item.id, safeObject(item.validationSummary))
    ),
    dataCutoffDate: audienceObservations.at(-1)?.date ?? null,
    calculatedAt: now.toISOString(),
    conflictingTrackTimelines,
    incompleteTrackIdentity,
    ambiguousReleaseMapping,
    reportPeriodUserEntered: contributingImports.some((item) => item.periodDatesUserConfirmed),
    timezoneUncertain: confirmedCampaignIntervals.some((interval) =>
      ["META_REPORT_SUGGESTION", "IMPORTED_EVIDENCE", "SYSTEM_INFERRED"].includes(
        interval.sourceType
      )
    )
  };
  return {
    analysis: calculateRetentionAnalysis(calculationInput),
    release: {id: release.id, title: release.title, releaseDate, artistId},
    campaign: {
      id: selected.id,
      name: selected.name,
      platform: selected.platform,
      status: selected.status
    },
    audienceObservations,
    trackObservations,
    timelineEvents: timelineEvents.map((event) => ({
      ...event,
      eventDate: dateOnly(event.eventDate)
    }))
  } satisfies ReleaseRetentionAnalysisContext;
}

export async function readReleaseRetentionAnalysis(
  releaseId: string,
  options: {campaignId?: string | null; now?: Date} = {}
) {
  return (await readReleaseRetentionAnalysisContext(releaseId, options)).analysis;
}
