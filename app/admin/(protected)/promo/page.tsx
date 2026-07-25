export const dynamic = "force-dynamic";

import Link from "next/link";
import {BarChart3} from "lucide-react";

import {readReleaseSummaries} from "@/lib/server/releases";
import {prisma} from "@/lib/db/prisma";
import {readLinkHubs} from "@/lib/repositories/link-hubs";
import {ActiveLinkHubs} from "@/components/active-link-hubs";

function getReleaseStatusText(release: {
  conceptComplete: boolean;
  beatMade: boolean;
  lyricsFinished: boolean;
  recorded: boolean;
  mixMastered: boolean;
  published: boolean;
}) {
  if (release.published) return "Published";
  if (release.mixMastered) return "Mix/Master Done";
  if (release.recorded) return "Recorded";
  if (release.lyricsFinished) return "Lyrics Finished";
  if (release.beatMade) return "Beat Made";
  if (release.conceptComplete) return "Concept Complete";
  return "Concept Phase";
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date range";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date range";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function TrackingConventionCard({
  eyebrow,
  title,
  destination,
  campaignPattern,
  adPattern,
  exampleCampaign,
  exampleAd,
  description
}: {
  eyebrow: string;
  title: string;
  destination: string;
  campaignPattern: string;
  adPattern: string;
  exampleCampaign: string;
  exampleAd: string;
  description: string;
}) {
  return (
    <article className="rounded-lg border border-edge bg-surface-elevated p-5">
      <p className="table-label text-status-info">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <span className="table-label block">Destination</span>
          <div className="mt-1 break-all rounded-md border border-edge bg-input px-3 py-2 font-mono text-xs text-secondary">
            {destination}
          </div>
        </div>
        <div>
          <span className="table-label block">Ad Name / utm_content</span>
          <div className="mt-1 break-all rounded-md border border-[rgba(246,201,69,0.24)] bg-brand-primary-soft px-3 py-2 font-mono text-xs text-brand-primary">
            {adPattern}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-edge bg-input px-3 py-3 font-mono text-xs leading-5 text-status-info">
        <div>utm_source=meta</div>
        <div>utm_medium=paid_social</div>
        <div>utm_campaign={campaignPattern}</div>
        <div>utm_content=exact_ad_name</div>
        <div>utm_term=audience_optional</div>
      </div>

      <div className="mt-4 border-t border-edge pt-3 text-[11px] leading-5 text-muted">
        <strong className="text-secondary">Example</strong>
        <div className="mt-1">
          Campaign: <code className="break-all text-status-info">{exampleCampaign}</code>
        </div>
        <div>
          Ad / content: <code className="break-all text-ink">{exampleAd}</code>
        </div>
      </div>
    </article>
  );
}

export default async function AdminPromoPage({
  searchParams
}: {
  searchParams: Promise<{releaseId?: string}>;
}) {
  const [{releaseId}, releases, linkHubs] = await Promise.all([
    searchParams,
    readReleaseSummaries(),
    readLinkHubs()
  ]);
  const activeReleaseId =
    releases.some((release) => release.id === releaseId) && releaseId ? releaseId : null;

  const latestImport = await prisma.adImportBatch.findFirst({
    where: activeReleaseId ? { releaseId: activeReleaseId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { release: { select: { title: true } } }
  });

  const latestArchivedDecision = await prisma.adCampaignLearning.findFirst({
    where: {
      reviewedAt: { not: null },
      ...(activeReleaseId ? { releaseId: activeReleaseId } : {})
    },
    orderBy: { reviewedAt: "desc" },
    include: {
      release: { select: { title: true } },
      importBatch: { select: { id: true, name: true } }
    }
  });

  const activeRelease = activeReleaseId
    ? await prisma.release.findUnique({
        where: { id: activeReleaseId }
      })
    : await prisma.release.findFirst({
        orderBy: { updatedOn: "desc" }
      });

  const latestDecisionLabel =
    latestArchivedDecision?.finalDecision || latestArchivedDecision?.decision || "";

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header Block */}
        <section className="command-surface overflow-hidden px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="status-badge-neutral">
                <BarChart3 size={12} />
                Promo
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Promo Home
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Plan, track, and learn from release campaigns.
              </p>
            </div>
          </div>
        </section>

        {/* Campaign Intelligence Section */}
        <section className="command-surface overflow-hidden px-5 py-5 sm:px-6">
          <div>
            <p className="field-label">Campaign Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Intelligence summary</h2>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col justify-between rounded-lg border border-edge bg-surface-elevated p-5">
              <div>
                <p className="table-label text-brand-primary">
                  {activeReleaseId ? "Campaign Release" : "Release Context"}
                </p>
                {activeRelease ? (
                  <div className="mt-3">
                    <h4 className="text-base font-semibold text-ink line-clamp-2">
                      {activeRelease.title}
                    </h4>
                    <div className="status-badge-warning mt-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
                      {getReleaseStatusText(activeRelease)}
                    </div>
                    {!activeReleaseId ? (
                      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted">
                        Most recently updated
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No release context available</p>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-edge bg-surface-elevated p-5">
              <div>
                <p className="table-label text-brand-primary">
                  Latest Import
                </p>
                {latestImport ? (
                  <div className="mt-3">
                    <Link
                      href={`/admin/ad-lab/${latestImport.id}`}
                      className="line-clamp-2 text-base font-semibold text-ink transition hover:text-brand-primary"
                    >
                      {latestImport.name || "Imported Meta Report"}
                    </Link>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      {latestImport.release?.title || "No linked release"}
                    </p>
                    <p className="text-[10px] text-muted">
                      {formatDate(latestImport.reportingStart?.toISOString() ?? null)} to {formatDate(latestImport.reportingEnd?.toISOString() ?? null)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No imports recorded</p>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-lg border border-edge bg-surface-elevated p-5">
              <div>
                <p className="table-label text-brand-primary">
                  Latest Decision
                </p>
                {latestArchivedDecision ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-semibold text-ink capitalize">
                        {latestDecisionLabel.replace(/-/g, " ")}
                      </h4>
                      {latestArchivedDecision.reviewedAt && (
                        <span className="text-[10px] text-muted">
                          {formatDate(latestArchivedDecision.reviewedAt.toISOString())}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted line-clamp-2">
                      {latestArchivedDecision.release?.title || "No release"}
                    </p>
                    {latestArchivedDecision.importBatch && (
                      <p className="text-[10px] text-muted">
                        Batch:{" "}
                        <Link
                          href={`/admin/ad-lab/${latestArchivedDecision.importBatchId}`}
                          className="text-brand-primary hover:underline"
                        >
                          {latestArchivedDecision.importBatch.name || "Meta Report"}
                        </Link>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">No archived decisions</p>
                )}
              </div>
            </div>

          </div>
        </section>

        <section className="command-surface overflow-hidden px-5 py-5 sm:px-6">
          <div>
            <p className="field-label">Campaign Tracking Conventions</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              Keep landing experiences distinct
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
              Use the same parser-safe creative name for Ad Lab. Change the campaign
              value to identify whether traffic lands on the single-release link hub
              or inside a playlist experience.
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <TrackingConventionCard
              adPattern="release_visual_songsection_revision"
              campaignPattern="release"
              description="Use for ads that send listeners to the manually selected single-release /links experience."
              destination="/links"
              eyebrow="Single Release"
              exampleAd="mahoraga_amv916_chorus_rev1"
              exampleCampaign="mahoraga"
              title="/links ads"
            />
            <TrackingConventionCard
              adPattern="release_visual_songsection_revision"
              campaignPattern="release_playlist_slug"
              description="Use for ads that open a specific release inside a playlist. The playlist slug belongs in the campaign value, not the ad name, so creative parsing stays intact."
              destination="/listen/playlist_slug/release_slug"
              eyebrow="Playlist Experience"
              exampleAd="will_amv_hook_rev1"
              exampleCampaign="will_nerd2dcore"
              title="Playlist ads"
            />
          </div>

          <p className="mt-4 rounded-md border border-[rgba(96,165,250,0.24)] bg-[rgba(96,165,250,0.05)] px-4 py-3 text-xs leading-5 text-secondary">
            <strong className="text-status-info">Matching rule:</strong>{" "}
            <code>Ad Name = utm_content</code>. Playlist campaigns add the playlist
            slug only to <code>utm_campaign</code>. This keeps Meta CSV creative
            analysis compatible while Attribution can separate `/links` and playlist
            arrivals.
          </p>
        </section>

        <ActiveLinkHubs hubs={linkHubs} />
      </div>
    </main>
  );
}
