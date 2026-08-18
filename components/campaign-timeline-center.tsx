"use client";

import Link from "next/link";
import {useState} from "react";
import {AlertTriangle, CalendarRange, LoaderCircle} from "lucide-react";

import {adminFetch, getAdminErrorMessage} from "@/lib/admin-errors";

type Option = {id: string; title?: string};
type Campaign = {id: string; name: string; platform: string; status: string; updatedAt: string; release: {id: string; title: string}; activeIntervals: Array<{confirmationStatus: string; activeStartDate: string | null; activeEndDate: string | null}>; overlaps: Array<Record<string, unknown>>};
type ListData = {page: number; pageSize: number; total: number; items: Campaign[]};

function provenance(value: string) { return value === "CONFIRMED" ? "Confirmed" : value === "SUGGESTED" ? "Suggested from evidence" : value.toLowerCase(); }

export function CampaignTimelineCenter({releases, initialData}: {releases: Option[]; initialData: ListData}) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({releaseId: "", platform: "", status: "", activeDate: "", confirmationStatus: ""});

  async function load() {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => value && query.set(key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value));
      setData(await adminFetch<ListData>(`/api/analytics/campaigns?${query}`));
    } catch (cause) {
      setError(getAdminErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-5 px-4 py-5 sm:px-6">
      <div><p className="field-label">Cross-release index</p><h2 className="mt-2 text-2xl font-semibold text-ink">Campaigns</h2><p className="mt-2 text-sm text-muted">Review campaigns across releases here. Create and manage a campaign from its release&apos;s Promotion &amp; Retention workspace.</p></div>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => {event.preventDefault(); void load();}}>
        <label className="field-shell"><span className="field-label">Release</span><select className="field-input" value={filters.releaseId} onChange={(event) => setFilters({...filters, releaseId: event.target.value})}><option value="">All</option>{releases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="field-shell"><span className="field-label">Platform</span><select className="field-input" value={filters.platform} onChange={(event) => setFilters({...filters, platform: event.target.value})}><option value="">All</option>{["META", "INSTAGRAM", "TIKTOK", "YOUTUBE", "EMAIL", "OTHER"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field-shell"><span className="field-label">Status</span><select className="field-input" value={filters.status} onChange={(event) => setFilters({...filters, status: event.target.value})}><option value="">All</option>{["DRAFT", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field-shell"><span className="field-label">Active date</span><input className="field-input" type="date" value={filters.activeDate} onChange={(event) => setFilters({...filters, activeDate: event.target.value})} /></label>
        <label className="field-shell"><span className="field-label">Confirmation</span><select className="field-input" value={filters.confirmationStatus} onChange={(event) => setFilters({...filters, confirmationStatus: event.target.value})}><option value="">All</option>{["CONFIRMED", "SUGGESTED", "REJECTED", "SUPERSEDED"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <button className="action-button-secondary sm:col-span-2 xl:col-span-1" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={15} /> : null} Apply filters</button>
      </form>
      {error ? <div className="state-panel-danger" role="alert"><AlertTriangle size={18} />{error}</div> : null}
      {!data.items.length ? <div className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-muted">No campaigns match this view.</div> : <div className="space-y-3">{data.items.map((item) => {
        const confirmed = item.activeIntervals.filter((interval) => interval.confirmationStatus === "CONFIRMED");
        const suggested = item.activeIntervals.filter((interval) => interval.confirmationStatus === "SUGGESTED").length;
        const open = confirmed.some((interval) => !interval.activeEndDate);
        return <article className="rounded-xl border border-edge bg-input p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{item.name}</h3><p className="mt-1 text-sm text-secondary">{item.release.title} · {item.platform} · {item.status}</p></div><Link className="action-button-secondary text-xs" href={`/admin/releases/${item.release.id}?manageCampaignId=${item.id}#campaign-management`}>Open release workspace</Link></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="status-badge-neutral">{confirmed.length} confirmed interval{confirmed.length === 1 ? "" : "s"}</span>{open ? <span className="status-badge-warning">Open interval</span> : null}{suggested ? <span className="status-badge-warning">{suggested} suggestion{suggested === 1 ? "" : "s"}</span> : null}{item.overlaps.length ? <span className="status-badge-warning">{item.overlaps.length} overlap warning{item.overlaps.length === 1 ? "" : "s"}</span> : null}</div><div className="mt-3 space-y-1 text-xs text-muted">{item.activeIntervals.map((interval, index) => <p key={index}><CalendarRange className="mr-1 inline" size={13} />{interval.activeStartDate} through {interval.activeEndDate || "open"} (inclusive) · {provenance(interval.confirmationStatus)}</p>)}</div><p className="mt-3 text-xs text-muted">Updated {new Date(item.updatedAt).toLocaleString()}</p></article>;
      })}</div>}
    </section>
  );
}
