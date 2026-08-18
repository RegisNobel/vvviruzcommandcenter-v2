import "server-only";

import {prisma} from "@/lib/db/prisma";
import {
  CANONICAL_ANALYTICS_ARTIST_ID,
  readCurrentAnalyticsDataset
} from "@/lib/repositories/analytics-imports";
import {
  metaPromotionScopeWhere,
  selectMostSpecificMetaPromotionLinks
} from "@/lib/ads/meta-promotion-links";

type SnapshotImport = {importType: string};
type SnapshotArtistMetric = {metricDate: Date};
type SnapshotTrackMetric = {releaseId: string; metricDate: Date};
type SnapshotMetaLink = {
  id: string;
  promotionCampaignId: string;
  accountId: string;
  scopeType: string;
  externalCampaignId: string;
  externalAdSetId: string;
  externalAdId: string;
  scopeIdentityKey: string;
  currentDisplayName: string;
  status: string;
  associationMode: string;
  monetaryAttribution: string;
  ambiguous: boolean;
  evidence: string;
};
type SnapshotCampaign = {
  id: string;
  confirmedIntervalCount: number;
  links: SnapshotMetaLink[];
};
type SnapshotMetaResolution = {
  id: string;
  accountId: string;
  campaignId: string;
  adSetId: string;
  adId: string;
  metricDate: Date;
  currency: string;
  currentObservation: {
    spend: number | null;
    sourceAsOf: Date | null;
  };
};

export type CampaignSourceSnapshot = {
  releaseId: string;
  spotify: {
    audienceImportCount: number;
    trackImportCount: number;
    latestAudienceDate: string | null;
    latestTrackDate: string | null;
  };
  campaigns: Array<{
    campaignId: string;
    confirmedIntervalCount: number;
    meta: {
      state: "UNLINKED" | "LINKED_EXTERNAL_SCOPE" | "LINKED_SHARED_PARENT" | "SHARED_UNALLOCATED";
      scopeCount: number;
      canonicalFactCount: number;
      positiveSpendFactCount: number;
      earliestMetricDate: string | null;
      latestMetricDate: string | null;
      latestSourceAsOf: string | null;
      externalScopeSpend: Array<{currency: string; totalCents: number}>;
    };
  }>;
};

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

function latestDate(values: Date[]) {
  if (!values.length) return null;
  return day(values.reduce((latest, value) => value > latest ? value : latest));
}

function earliestDate(values: Date[]) {
  if (!values.length) return null;
  return day(values.reduce((earliest, value) => value < earliest ? value : earliest));
}

function matchesLink(resolution: SnapshotMetaResolution, link: SnapshotMetaLink) {
  if (resolution.accountId !== link.accountId || resolution.campaignId !== link.externalCampaignId) return false;
  if ((link.scopeType === "AD_SET" || link.scopeType === "AD") && resolution.adSetId !== link.externalAdSetId) return false;
  return link.scopeType !== "AD" || resolution.adId === link.externalAdId;
}

export function buildCampaignSourceSnapshot(input: {
  releaseId: string;
  campaigns: SnapshotCampaign[];
  imports: SnapshotImport[];
  artistMetricObservations: SnapshotArtistMetric[];
  trackMetricObservations: SnapshotTrackMetric[];
  metaResolutions: SnapshotMetaResolution[];
}): CampaignSourceSnapshot {
  return {
    releaseId: input.releaseId,
    spotify: {
      audienceImportCount: input.imports.filter((item) => item.importType === "ARTIST_AUDIENCE_TIMELINE").length,
      trackImportCount: input.imports.filter((item) => item.importType === "TRACK_STREAM_TIMELINE").length,
      latestAudienceDate: latestDate(input.artistMetricObservations.map((item) => item.metricDate)),
      latestTrackDate: latestDate(input.trackMetricObservations.filter((item) => item.releaseId === input.releaseId).map((item) => item.metricDate))
    },
    campaigns: input.campaigns.map((campaign) => {
      const links = selectMostSpecificMetaPromotionLinks(campaign.links);
      const resolutionsById = new Map(
        input.metaResolutions
          .filter((resolution) => links.some((link) => matchesLink(resolution, link)))
          .map((resolution) => [resolution.id, resolution])
      );
      const resolutions = [...resolutionsById.values()];
      const spendByCurrency = new Map<string, number>();
      for (const resolution of resolutions) {
        if (resolution.currentObservation.spend === null) continue;
        const currency = resolution.currency.trim().toUpperCase() || "UNKNOWN";
        spendByCurrency.set(currency, (spendByCurrency.get(currency) ?? 0) + Math.round(resolution.currentObservation.spend * 100));
      }
      const sharedUnallocated = links.some((link) => link.ambiguous || link.monetaryAttribution === "UNALLOCATED_SHARED");
      const sharedParent = links.some((link) => link.associationMode.startsWith("SHARED_"));
      const metricDates = resolutions.map((item) => item.metricDate);
      const sourceDates = resolutions.flatMap((item) => item.currentObservation.sourceAsOf ? [item.currentObservation.sourceAsOf] : []);
      return {
        campaignId: campaign.id,
        confirmedIntervalCount: campaign.confirmedIntervalCount,
        meta: {
          state: links.length
            ? sharedUnallocated
              ? "SHARED_UNALLOCATED"
              : sharedParent
                ? "LINKED_SHARED_PARENT"
                : "LINKED_EXTERNAL_SCOPE"
            : "UNLINKED",
          scopeCount: links.length,
          canonicalFactCount: resolutions.length,
          positiveSpendFactCount: resolutions.filter((item) => (item.currentObservation.spend ?? 0) > 0).length,
          earliestMetricDate: earliestDate(metricDates),
          latestMetricDate: latestDate(metricDates),
          latestSourceAsOf: latestDate(sourceDates),
          externalScopeSpend: [...spendByCurrency.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([currency, totalCents]) => ({currency, totalCents}))
        }
      };
    })
  };
}

export async function readCampaignSourceSnapshot(releaseId: string): Promise<CampaignSourceSnapshot | null> {
  const [release, campaigns] = await Promise.all([
    prisma.release.findUnique({
      where: {id: releaseId},
      select: {id: true, catalogScope: true, primaryArtistProfileId: true}
    }),
    prisma.promotionCampaign.findMany({
      where: {releaseId, archivedAt: null},
      select: {
        id: true,
        activeIntervals: {
          where: {confirmationStatus: "CONFIRMED", supersededBy: null},
          select: {id: true}
        },
        metaPromotionLinks: {
          where: {status: "CONFIRMED", supersededBy: null},
          select: {
            id: true,
            promotionCampaignId: true,
            accountId: true,
            scopeType: true,
            externalCampaignId: true,
            externalAdSetId: true,
            externalAdId: true,
            scopeIdentityKey: true,
            currentDisplayName: true,
            status: true,
            associationMode: true,
            monetaryAttribution: true,
            ambiguous: true,
            evidence: true
          }
        }
      },
      orderBy: [{createdAt: "asc"}, {id: "asc"}]
    })
  ]);
  if (!release) return null;

  const artistProfileId = release.primaryArtistProfileId ?? (release.catalogScope === "VVVIRUZ" ? CANONICAL_ANALYTICS_ARTIST_ID : null);
  const links = campaigns.flatMap((campaign) => selectMostSpecificMetaPromotionLinks(campaign.metaPromotionLinks));
  const [dataset, metaResolutions] = await Promise.all([
    artistProfileId
      ? readCurrentAnalyticsDataset(artistProfileId)
      : Promise.resolve({imports: [], artistMetricObservations: [], trackMetricObservations: [], songPeriodSnapshots: [], playlistPeriodSnapshots: []}),
    links.length
      ? prisma.metaDailyResolution.findMany({
          where: {
            metricFamily: "SPEND",
            OR: links.map((link) => metaPromotionScopeWhere(link)),
            currentObservation: {
              is: {
                importBatch: {
                  is: {
                    coreTimingEligible: true,
                    importState: "ACCEPTED",
                    withdrawnAt: null
                  }
                }
              }
            }
          },
          select: {
            id: true,
            accountId: true,
            campaignId: true,
            adSetId: true,
            adId: true,
            metricDate: true,
            currency: true,
            currentObservation: {select: {spend: true, sourceAsOf: true}}
          }
        })
      : Promise.resolve([])
  ]);

  return buildCampaignSourceSnapshot({
    releaseId,
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      confirmedIntervalCount: campaign.activeIntervals.length,
      links: campaign.metaPromotionLinks
    })),
    imports: dataset.imports,
    artistMetricObservations: dataset.artistMetricObservations,
    trackMetricObservations: dataset.trackMetricObservations,
    metaResolutions
  });
}
