"use client";

import {useState} from "react";
import {LoaderCircle, Plus} from "lucide-react";

import {adminFetch, getAdminErrorMessage} from "@/lib/admin-errors";

export function ReleaseCampaignCreator({artistProfileId, releaseId}: {artistProfileId: string; releaseId: string}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({platform: "META", name: "", objective: "STREAMS", notes: "", externalCampaignId: "", externalCampaignName: ""});

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await adminFetch<{campaignId: string}>("/api/analytics/campaigns", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({...form, artistProfileId, releaseId})
      });
      window.location.assign(`/admin/releases/${releaseId}?manageCampaignId=${result.campaignId}#campaign-management`);
    } catch (cause) {
      setError(getAdminErrorMessage(cause));
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-edge bg-input p-4">
      <summary className="cursor-pointer font-semibold text-ink">Create a campaign for this release</summary>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={create}>
        <label className="field-shell sm:col-span-2"><span className="field-label">Campaign name</span><input className="field-input" maxLength={200} required value={form.name} onChange={(event) => setForm({...form, name: event.target.value})} /></label>
        <label className="field-shell"><span className="field-label">Platform</span><select className="field-input" value={form.platform} onChange={(event) => setForm({...form, platform: event.target.value})}>{["META", "INSTAGRAM", "TIKTOK", "YOUTUBE", "EMAIL", "OTHER"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field-shell"><span className="field-label">Objective</span><select className="field-input" value={form.objective} onChange={(event) => setForm({...form, objective: event.target.value})}>{["AWARENESS", "TRAFFIC", "ENGAGEMENT", "CONVERSIONS", "STREAMS", "PRESAVE", "RETARGETING", "OTHER"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field-shell"><span className="field-label">Meta / platform identity</span><input className="field-input" maxLength={300} value={form.externalCampaignName} onChange={(event) => setForm({...form, externalCampaignName: event.target.value})} /></label>
        <label className="field-shell"><span className="field-label">External campaign ID</span><input className="field-input" maxLength={200} value={form.externalCampaignId} onChange={(event) => setForm({...form, externalCampaignId: event.target.value})} /></label>
        <label className="field-shell sm:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-24" maxLength={2000} value={form.notes} onChange={(event) => setForm({...form, notes: event.target.value})} /></label>
        {error ? <div className="state-panel-danger sm:col-span-2" role="alert">{error}</div> : null}
        <button className="action-button-primary sm:col-span-2" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Create campaign</button>
      </form>
    </details>
  );
}
