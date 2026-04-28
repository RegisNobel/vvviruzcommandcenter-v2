export const dynamic = "force-dynamic";

import {Activity, BarChart3, Link2, MousePointerClick, TrendingUp, Users} from "lucide-react";

import {readLinkPageAnalytics} from "@/lib/repositories/analytics";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#30343b] bg-[#121418] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">{label}</p>
        <span className="rounded-full border border-[#4a3c1d] bg-[#1a1710] p-2 text-[#d7b45e]">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

function BreakdownList({
  emptyText,
  items,
  title
}: {
  emptyText: string;
  items: Array<{label: string; count: number}>;
  title: string;
}) {
  return (
    <section className="rounded-[26px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className="flex items-center justify-between gap-4 rounded-[18px] border border-[#252a31] bg-[#0f1114] px-4 py-3"
              key={item.label}
            >
              <span className="min-w-0 truncate text-sm text-[#d9dee5]">{item.label}</span>
              <span className="pill">{formatNumber(item.count)}</span>
            </div>
          ))
        ) : (
          <p className="rounded-[18px] border border-dashed border-[#30343b] bg-[#0f1114] px-4 py-4 text-sm text-muted">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const analytics = await readLinkPageAnalytics(30);

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <BarChart3 size={12} />
                Analytics v1
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Link-page conversion tracking
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Tracks public `/links` page views and outbound clicks so you can see
                whether the campaign landing page is turning attention into action.
              </p>
            </div>
            <div className="rounded-[18px] border border-[#30343b] bg-[#121418] px-4 py-3 text-sm text-muted">
              Last update: {formatTimestamp(analytics.updatedAt)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={Activity}
            label="Views"
            note="All /links page loads in the selected window."
            value={formatNumber(analytics.overview.views)}
          />
          <MetricCard
            icon={MousePointerClick}
            label="Conversions"
            note="Outbound link clicks from the link hub."
            value={formatNumber(analytics.overview.conversions)}
          />
          <MetricCard
            icon={TrendingUp}
            label="CTR"
            note="Conversions divided by page views."
            value={`${analytics.overview.ctr}%`}
          />
          <MetricCard
            icon={Users}
            label="Unique Visitors"
            note="Anonymous visitor cookie count."
            value={formatNumber(analytics.overview.uniqueVisitors)}
          />
          <MetricCard
            icon={Link2}
            label="Unique Converters"
            note="Unique visitors who clicked at least one link."
            value={formatNumber(analytics.overview.uniqueConverters)}
          />
        </section>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-[#30343b] px-4 py-5 sm:px-6">
            <p className="field-label">Daily analytics</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Last 30 days</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Views</th>
                  <th className="px-4 py-3 font-semibold">Conversions</th>
                  <th className="px-4 py-3 font-semibold">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31]">
                {analytics.daily.map((day) => (
                  <tr className="text-[#d9dee5]" key={day.date}>
                    <td className="px-4 py-4 font-semibold">{formatDate(day.date)}</td>
                    <td className="px-4 py-4">{formatNumber(day.views)}</td>
                    <td className="px-4 py-4">{formatNumber(day.conversions)}</td>
                    <td className="px-4 py-4">{day.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <BreakdownList
            emptyText="No conversion clicks recorded yet."
            items={analytics.platforms}
            title="Conversions by platform"
          />
          <BreakdownList
            emptyText="No target links recorded yet."
            items={analytics.topTargets}
            title="Top clicked links"
          />
          <BreakdownList
            emptyText="No referrer data recorded yet."
            items={analytics.referrers}
            title="Top referrers"
          />
          <BreakdownList
            emptyText="No UTM/source data recorded yet."
            items={analytics.sources}
            title="Source / UTM breakdown"
          />
        </section>
      </div>
    </main>
  );
}
