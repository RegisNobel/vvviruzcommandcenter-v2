"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft, ExternalLink, Save} from "lucide-react";

import {AdsDeleteBatchButton} from "@/components/ads-delete-batch-button";
import {defaultAdAttributionSetting} from "@/lib/ads/batch-metadata";
import {
  formatContentType,
  formatHookType,
  formatSongSection,
  hookTypeOptions,
  contentTypeOptions,
  songSectionOptions
} from "@/lib/copy";
import type {
  AdCampaignDecision,
  AdCreativeReportRecord,
  AdImportBatchDetail,
  AdStrategyBreakdownRow,
  CopyContentType,
  CopySongSection,
  HookType
} from "@/lib/types";

type SortKey =
  | "spend"
  | "results"
  | "cost_per_result"
  | "link_clicks"
  | "cpc"
  | "ctr"
  | "thru_plays"
  | "video_100"
  | "post_saves"
  | "post_shares"
  | "instagram_follows";

type FilterValue = "all" | "linked" | "unlinked" | string;

const sortOptions: Array<{value: SortKey; label: string}> = [
  {value: "spend", label: "Spend"},
  {value: "results", label: "Results"},
  {value: "cost_per_result", label: "Cost / Result"},
  {value: "link_clicks", label: "Link Clicks"},
  {value: "cpc", label: "CPC"},
  {value: "ctr", label: "CTR"},
  {value: "thru_plays", label: "ThruPlays"},
  {value: "video_100", label: "100% Plays"},
  {value: "post_saves", label: "Saves"},
  {value: "post_shares", label: "Shares"},
  {value: "instagram_follows", label: "IG Follows"}
];

const decisionOptions: Array<{value: AdCampaignDecision; label: string}> = [
  {value: "scale", label: "Scale"},
  {value: "retest", label: "Retest"},
  {value: "iterate", label: "Iterate"},
  {value: "pause", label: "Pause"},
  {value: "archive", label: "Archive"}
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatStrategyValue(value: string, kind: "hook" | "content" | "section") {
  if (value === "Unlinked") {
    return value;
  }

  if (kind === "hook") {
    return formatHookType(value as HookType);
  }

  if (kind === "content") {
    return formatContentType(value as CopyContentType);
  }

  return formatSongSection(value as CopySongSection);
}

function getSortValue(report: AdCreativeReportRecord, sortKey: SortKey) {
  return report[sortKey] ?? -1;
}

function MetricCard({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#30343b] bg-[#121418] px-4 py-4">
      <p className="field-label">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

function StrategyTable({
  rows,
  title
}: {
  rows: AdStrategyBreakdownRow[];
  title: string;
}) {
  return (
    <section className="rounded-[26px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#171a1f] text-[#b8bec6]">
            <tr>
              <th className="px-3 py-3 font-semibold">Segment</th>
              <th className="px-3 py-3 font-semibold">Spend</th>
              <th className="px-3 py-3 font-semibold">Results</th>
              <th className="px-3 py-3 font-semibold">Clicks</th>
              <th className="px-3 py-3 font-semibold">CTR</th>
              <th className="px-3 py-3 font-semibold">Rows</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#252a31]">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr className="text-[#d9dee5]" key={row.label}>
                  <td className="px-3 py-3 font-semibold">{row.label}</td>
                  <td className="px-3 py-3">{formatMoney(row.spend)}</td>
                  <td className="px-3 py-3">{formatNumber(row.results)}</td>
                  <td className="px-3 py-3">{formatNumber(row.link_clicks)}</td>
                  <td className="px-3 py-3">{formatPercent(row.ctr)}</td>
                  <td className="px-3 py-3">{formatNumber(row.report_count)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-5 text-center text-muted" colSpan={6}>
                  No strategy data yet. Link ad rows to Copy Lab entries to populate this.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdsBatchDashboard({detail}: {detail: AdImportBatchDetail}) {
  const router = useRouter();
  const [hookFilter, setHookFilter] = useState<FilterValue>("all");
  const [contentFilter, setContentFilter] = useState<FilterValue>("all");
  const [sectionFilter, setSectionFilter] = useState<FilterValue>("all");
  const [linkFilter, setLinkFilter] = useState<FilterValue>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [learning, setLearning] = useState({
    summary: detail.learning?.summary ?? "",
    what_worked: detail.learning?.what_worked ?? "",
    what_failed: detail.learning?.what_failed ?? "",
    next_test: detail.learning?.next_test ?? "",
    decision: detail.learning?.decision ?? "iterate"
  });
  const [isSavingLearning, setIsSavingLearning] = useState(false);

  const filteredReports = useMemo(() => {
    return detail.reports
      .filter((report) => {
        if (linkFilter === "linked" && !report.linked_copy) {
          return false;
        }

        if (linkFilter === "unlinked" && report.linked_copy) {
          return false;
        }

        if (hookFilter !== "all" && report.linked_copy?.hook_type !== hookFilter) {
          return false;
        }

        if (contentFilter !== "all" && report.linked_copy?.content_type !== contentFilter) {
          return false;
        }

        if (sectionFilter !== "all" && report.linked_copy?.song_section !== sectionFilter) {
          return false;
        }

        return true;
      })
      .sort((left, right) => getSortValue(right, sortKey) - getSortValue(left, sortKey));
  }, [contentFilter, detail.reports, hookFilter, linkFilter, sectionFilter, sortKey]);

  async function handleCopyLink(reportId: string, copyEntryId: string | null) {
    setPendingReportId(reportId);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/reports/${reportId}/copy-link`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({copy_entry_id: copyEntryId})
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Copy link update failed.");
      }

      setMessage("Copy link updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copy link update failed.");
    } finally {
      setPendingReportId(null);
    }
  }

  async function handleLearningSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingLearning(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/batches/${detail.id}/learnings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...learning,
          release_id: detail.release_id
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Learning save failed.");
      }

      setMessage("Campaign learning saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning save failed.");
    } finally {
      setIsSavingLearning(false);
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="panel px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Meta Ads Analytics</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {detail.name || "Imported Meta Report"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                {detail.release_title ? `${detail.release_title} · ` : ""}
                {formatDate(detail.reporting_start)} to {formatDate(detail.reporting_end)}
              </p>
              <p className="mt-2 max-w-3xl text-xs uppercase tracking-[0.14em] text-muted">
                Files: {detail.file_names.length > 0 ? detail.file_names.join(", ") : "No file names recorded"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="action-button-secondary" href="/admin/ads">
                <ArrowLeft size={16} />
                Ads Home
              </Link>
              <Link className="action-button-primary" href="/admin/ads/import">
                Import CSV
              </Link>
              <AdsDeleteBatchButton
                batchId={detail.id}
                batchName={detail.name || "Imported Meta Report"}
              />
            </div>
          </div>
        </section>

        <section className="panel px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="field-label">Reporting Start</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatDate(detail.reporting_start)}
              </p>
            </div>
            <div>
              <p className="field-label">Reporting End</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatDate(detail.reporting_end)}
              </p>
            </div>
            <div>
              <p className="field-label">Exported At</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {formatDateTime(detail.exported_at)}
              </p>
            </div>
            <div>
              <p className="field-label">Attribution Setting</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {detail.attribution_setting || defaultAdAttributionSetting}
              </p>
            </div>
            <div>
              <p className="field-label">Batch Type</p>
              <p className="mt-2 text-sm font-semibold text-ink">{detail.batch_type}</p>
            </div>
          </div>

          {detail.batch_type === "Rolling Snapshot" ? (
            <div className="mt-5 rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm leading-6 text-[#d7b45e]">
              This is an overlapping Meta snapshot. Do not sum it with other overlapping batches.
            </div>
          ) : null}
        </section>

        {detail.linked_copy_count > 0 ? (
          <div className="rounded-[22px] border border-[#30343b] bg-[#121418] px-4 py-3 text-sm leading-6 text-muted">
            <span className="font-semibold text-ink">{formatNumber(detail.linked_copy_count)}</span>{" "}
            Copy Lab link{detail.linked_copy_count === 1 ? "" : "s"} are active in this batch.
            New imports for the same release auto-carry links forward when normalized ad names match.
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Spend" note="Total imported Meta spend." value={formatMoney(detail.spend)} />
          <MetricCard label="Impressions" note="Imported ad impressions." value={formatNumber(detail.impressions)} />
          <MetricCard label="Reach" note="Imported Meta reach." value={formatNumber(detail.reach)} />
          <MetricCard label="Results" note="Meta results from CSV." value={formatNumber(detail.results)} />
          <MetricCard label="Cost / Result" note="Spend divided by results." value={formatMoney(detail.results > 0 ? detail.spend / detail.results : null)} />
          <MetricCard label="Link Clicks" note="Meta link click count." value={formatNumber(detail.link_clicks)} />
          <MetricCard label="CPC" note="Spend divided by link clicks." value={formatMoney(detail.link_clicks > 0 ? detail.spend / detail.link_clicks : null)} />
          <MetricCard label="CTR" note="Clicks divided by impressions." value={formatPercent(detail.ctr)} />
          <MetricCard label="ThruPlays" note="Completed video attention signal." value={formatNumber(detail.reports.reduce((total, report) => total + (report.thru_plays ?? 0), 0))} />
          <MetricCard label="100% Plays" note="Full video play count." value={formatNumber(detail.reports.reduce((total, report) => total + (report.video_100 ?? 0), 0))} />
        </section>

        {message ? (
          <div className="rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm text-[#d7b45e]">
            {message}
          </div>
        ) : null}

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="field-label">Creative Leaderboard</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Ad performance by creative</h2>
            </div>

            <div className="grid w-full gap-3 md:w-auto md:grid-cols-5">
              <select className="field-input" onChange={(event) => setHookFilter(event.target.value)} value={hookFilter}>
                <option value="all">All Hook Types</option>
                {hookTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatHookType(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setContentFilter(event.target.value)} value={contentFilter}>
                <option value="all">All Content Types</option>
                {contentTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatContentType(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}>
                <option value="all">All Song Sections</option>
                {songSectionOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatSongSection(value)}
                  </option>
                ))}
              </select>
              <select className="field-input" onChange={(event) => setLinkFilter(event.target.value)} value={linkFilter}>
                <option value="all">Linked + Unlinked</option>
                <option value="linked">Linked Copy</option>
                <option value="unlinked">Unlinked Copy</option>
              </select>
              <select className="field-input" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    Sort: {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Ad Name</th>
                  <th className="px-3 py-3 font-semibold">Linked Copy</th>
                  <th className="px-3 py-3 font-semibold">Delivery</th>
                  <th className="px-3 py-3 font-semibold">Spend</th>
                  <th className="px-3 py-3 font-semibold">Results</th>
                  <th className="px-3 py-3 font-semibold">Cost / Result</th>
                  <th className="px-3 py-3 font-semibold">Link Clicks</th>
                  <th className="px-3 py-3 font-semibold">CPC</th>
                  <th className="px-3 py-3 font-semibold">CTR</th>
                  <th className="px-3 py-3 font-semibold">ThruPlays</th>
                  <th className="px-3 py-3 font-semibold">100% Plays</th>
                  <th className="px-3 py-3 font-semibold">Saves</th>
                  <th className="px-3 py-3 font-semibold">Shares</th>
                  <th className="px-3 py-3 font-semibold">IG Follows</th>
                  <th className="px-3 py-3 font-semibold">Performance Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31]">
                {filteredReports.map((report) => (
                  <tr className="align-top text-[#d9dee5]" key={report.id}>
                    <td className="max-w-[260px] px-3 py-4">
                      <p className="font-semibold text-ink">{report.ad_name}</p>
                      <p className="mt-1 text-xs text-muted">{report.ad_set_name || "No ad set"}</p>
                      {report.utm_campaign || report.utm_content ? (
                        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted">
                          {report.utm_campaign || "No campaign"} / {report.utm_content || "No content"}
                        </p>
                      ) : null}
                    </td>
                    <td className="min-w-[250px] px-3 py-4">
                      <select
                        className="field-input"
                        disabled={pendingReportId === report.id}
                        onChange={(event) =>
                          void handleCopyLink(report.id, event.target.value || null)
                        }
                        value={report.linked_copy?.id ?? ""}
                      >
                        <option value="">No linked copy</option>
                        {detail.available_copies.map((copy) => (
                          <option key={copy.id} value={copy.id}>
                            {copy.hook.trim() || `Copy ${copy.id.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                      {report.linked_copy ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="pill">
                            {formatHookType(report.linked_copy.hook_type)}
                          </span>
                          <span className="pill">
                            {formatContentType(report.linked_copy.content_type)}
                          </span>
                          <span className="pill">
                            {formatSongSection(report.linked_copy.song_section)}
                          </span>
                          {report.linked_copy.creative_notes ? (
                            <p className="mt-2 text-xs leading-5 text-muted">
                              {report.linked_copy.creative_notes}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted">Unlinked copy row.</p>
                      )}
                    </td>
                    <td className="px-3 py-4">{report.ad_delivery || "—"}</td>
                    <td className="px-3 py-4">{formatMoney(report.spend)}</td>
                    <td className="px-3 py-4">{formatNumber(report.results)}</td>
                    <td className="px-3 py-4">{formatMoney(report.cost_per_result)}</td>
                    <td className="px-3 py-4">{formatNumber(report.link_clicks)}</td>
                    <td className="px-3 py-4">{formatMoney(report.cpc)}</td>
                    <td className="px-3 py-4">{formatPercent(report.ctr)}</td>
                    <td className="px-3 py-4">{formatNumber(report.thru_plays)}</td>
                    <td className="px-3 py-4">{formatNumber(report.video_100)}</td>
                    <td className="px-3 py-4">{formatNumber(report.post_saves)}</td>
                    <td className="px-3 py-4">{formatNumber(report.post_shares)}</td>
                    <td className="px-3 py-4">{formatNumber(report.instagram_follows)}</td>
                    <td className="min-w-[220px] px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        {report.performance_signals.length > 0 ? (
                          report.performance_signals.map((signal) => (
                            <span className="pill" key={signal}>
                              {signal}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No signal yet</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#30343b] bg-[#121418] px-4 py-6 text-center text-sm text-muted">
              No ad rows match the current filters.
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <StrategyTable
            rows={detail.strategy_breakdowns.hook_type.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "hook")
            }))}
            title="Performance by Hook Type"
          />
          <StrategyTable
            rows={detail.strategy_breakdowns.content_type.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "content")
            }))}
            title="Performance by Content Type"
          />
          <StrategyTable
            rows={detail.strategy_breakdowns.song_section.map((row) => ({
              ...row,
              label: formatStrategyValue(row.label, "section")
            }))}
            title="Performance by Song Section"
          />
          <StrategyTable rows={detail.strategy_breakdowns.combo} title="Performance by Combo" />
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div>
            <p className="field-label">/links Follow-Through</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Meta clicks to streaming intent</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Matches existing link-page analytics when UTM source is `meta` and both
              `utm_campaign` and `utm_content` line up with the imported ad row.
            </p>
          </div>

          {detail.link_follow_through.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#171a1f] text-[#b8bec6]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Ad</th>
                    <th className="px-3 py-3 font-semibold">Meta Clicks</th>
                    <th className="px-3 py-3 font-semibold">Page Views</th>
                    <th className="px-3 py-3 font-semibold">Streaming Clicks</th>
                    <th className="px-3 py-3 font-semibold">Spotify</th>
                    <th className="px-3 py-3 font-semibold">Apple</th>
                    <th className="px-3 py-3 font-semibold">YouTube</th>
                    <th className="px-3 py-3 font-semibold">Click → View</th>
                    <th className="px-3 py-3 font-semibold">View → Stream</th>
                    <th className="px-3 py-3 font-semibold">Meta → Stream</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252a31]">
                  {detail.link_follow_through.map((row) => {
                    const report = detail.reports.find((item) => item.id === row.ad_report_id);

                    return (
                      <tr className="text-[#d9dee5]" key={row.ad_report_id}>
                        <td className="px-3 py-4 font-semibold">{report?.ad_name ?? "Ad row"}</td>
                        <td className="px-3 py-4">{formatNumber(row.meta_link_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.links_page_views)}</td>
                        <td className="px-3 py-4">{formatNumber(row.outbound_streaming_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.spotify_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.apple_music_clicks)}</td>
                        <td className="px-3 py-4">{formatNumber(row.youtube_music_clicks)}</td>
                        <td className="px-3 py-4">{formatPercent(row.click_to_view_match_percentage)}</td>
                        <td className="px-3 py-4">{formatPercent(row.view_to_stream_intent_percentage)}</td>
                        <td className="px-3 py-4">{formatPercent(row.meta_click_to_stream_intent_percentage)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-[#30343b] bg-[#121418] px-4 py-6 text-sm text-muted">
              No matching /links data yet. Use UTM source `meta` plus matching
              `utm_campaign` and `utm_content` values to connect Meta clicks to
              link-page follow-through.
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6" onSubmit={handleLearningSave}>
            <div>
              <p className="field-label">Campaign Learnings</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Manual readout</h2>
            </div>

            <label className="space-y-2">
              <span className="field-label">Campaign Summary</span>
              <textarea
                className="field-input min-h-[100px]"
                onChange={(event) =>
                  setLearning((current) => ({...current, summary: event.target.value}))
                }
                value={learning.summary}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">What Worked</span>
                <textarea
                  className="field-input min-h-[120px]"
                  onChange={(event) =>
                    setLearning((current) => ({...current, what_worked: event.target.value}))
                  }
                  value={learning.what_worked}
                />
              </label>
              <label className="space-y-2">
                <span className="field-label">What Failed</span>
                <textarea
                  className="field-input min-h-[120px]"
                  onChange={(event) =>
                    setLearning((current) => ({...current, what_failed: event.target.value}))
                  }
                  value={learning.what_failed}
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="field-label">Next Test</span>
              <textarea
                className="field-input min-h-[100px]"
                onChange={(event) =>
                  setLearning((current) => ({...current, next_test: event.target.value}))
                }
                value={learning.next_test}
              />
            </label>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="space-y-2">
                <span className="field-label">Decision</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    setLearning((current) => ({
                      ...current,
                      decision: event.target.value as AdCampaignDecision
                    }))
                  }
                  value={learning.decision}
                >
                  {decisionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button className="action-button-primary" disabled={isSavingLearning} type="submit">
                <Save size={16} />
                {isSavingLearning ? "Saving..." : "Save Learning"}
              </button>
            </div>
          </form>

          <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <p className="field-label">Saved Learning</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {detail.learning ? "Latest readout" : "No learning saved"}
              </h2>
            </div>
            {detail.learning ? (
              <div className="space-y-4 text-sm leading-6 text-muted">
                <p>
                  <span className="field-label block">Decision</span>
                  <span className="font-semibold capitalize text-ink">{detail.learning.decision}</span>
                </p>
                <p>
                  <span className="field-label block">Summary</span>
                  {detail.learning.summary || "No summary yet."}
                </p>
                <p>
                  <span className="field-label block">Next Test</span>
                  {detail.learning.next_test || "No next test noted yet."}
                </p>
              </div>
            ) : (
              <p className="rounded-[22px] border border-dashed border-[#30343b] bg-[#121418] px-4 py-6 text-sm text-muted">
                Save a campaign learning once you have enough signal from this batch.
              </p>
            )}
          </section>
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label">Raw Imported Rows</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Debug table</h2>
            </div>
            <Link className="action-button-tertiary" href="/admin/analytics">
              Link-page analytics
              <ExternalLink size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 font-semibold">Ad Set</th>
                  <th className="px-3 py-3 font-semibold">Ad</th>
                  <th className="px-3 py-3 font-semibold">Date Range</th>
                  <th className="px-3 py-3 font-semibold">Spend</th>
                  <th className="px-3 py-3 font-semibold">Impressions</th>
                  <th className="px-3 py-3 font-semibold">Reach</th>
                  <th className="px-3 py-3 font-semibold">UTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31]">
                {detail.reports.map((report) => (
                  <tr className="text-[#d9dee5]" key={report.id}>
                    <td className="px-3 py-4">{report.campaign_name || "—"}</td>
                    <td className="px-3 py-4">{report.ad_set_name || "—"}</td>
                    <td className="px-3 py-4 font-semibold">{report.ad_name}</td>
                    <td className="px-3 py-4">
                      {formatDate(report.reporting_start)} → {formatDate(report.reporting_end)}
                    </td>
                    <td className="px-3 py-4">{formatMoney(report.spend)}</td>
                    <td className="px-3 py-4">{formatNumber(report.impressions)}</td>
                    <td className="px-3 py-4">{formatNumber(report.reach)}</td>
                    <td className="px-3 py-4">
                      {report.utm_source || report.utm_campaign || report.utm_content
                        ? `${report.utm_source || "no source"} / ${report.utm_campaign || "no campaign"} / ${report.utm_content || "no content"}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
