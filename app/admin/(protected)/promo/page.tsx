export const dynamic = "force-dynamic";

import Link from "next/link";
import {BarChart3, Camera, ArrowRight} from "lucide-react";

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

          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="flex flex-col justify-between rounded-lg border border-edge bg-surface-elevated p-5">
              <div>
                <p className="table-label text-brand-primary">
                  Naming + UTM Convention
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted block">Ad Name Pattern</span>
                    <div className="mt-1 break-all rounded-md border border-[rgba(246,201,69,0.24)] bg-brand-primary-soft px-3 py-1.5 font-mono text-xs text-brand-primary">
                      release_visual_songsection_revision
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted block">UTM Mapping</span>
                    <div className="mt-1 space-y-1 rounded-md border border-edge bg-input px-3 py-1.5 font-mono text-xs text-status-info">
                      <div>utm_source=meta</div>
                      <div>utm_medium=paid_social</div>
                      <div>utm_campaign=release</div>
                      <div>utm_content=release_visual_songsection_revision</div>
                    </div>
                  </div>
                  <p className="border-t border-edge pt-2 text-[10px] leading-4 text-muted">
                    <strong>Example (Mahoraga):</strong>
                    <br />
                    Ad: <code className="text-ink font-mono text-[10px]">mahoraga_amv916_chorus_rev1</code>
                    <br />
                    UTM content: <code className="font-mono text-[10px] text-status-info">mahoraga_amv916_chorus_rev1</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* Future Tools Section */}
            <section className="command-surface h-full px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <h2 className="table-label text-brand-primary">
                  Future Tools
                </h2>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="group rounded-lg border border-edge bg-surface-elevated px-4 py-4 transition hover:border-edge-strong hover:bg-surface-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-md border border-[rgba(246,201,69,0.24)] bg-brand-primary-soft p-2 text-brand-primary">
                        <Camera size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                          Photo Lab
                          <span className="status-badge-warning px-2 py-0.5 text-[10px]">
                            Coming Soon
                          </span>
                        </h3>
                        <p className="mt-1 text-xs text-muted">
                          Create and manage promo visuals, cover assets, and image-based creative.
                        </p>
                      </div>
                    </div>
                    <Link
                      className="rounded-md border border-edge bg-transparent p-1.5 text-muted transition hover:border-[rgba(246,201,69,0.5)] hover:bg-surface-hover hover:text-brand-primary"
                      href="/admin/photo-lab"
                      title="Preview Photo Lab"
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div>
            <ActiveLinkHubs hubs={linkHubs} />
          </div>
        </div>
      </div>
    </main>
  );
}
