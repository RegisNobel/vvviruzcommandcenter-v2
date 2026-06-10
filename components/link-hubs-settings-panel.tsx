"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import {useState, useEffect} from "react";

import type {LinkHubRecord, ReleaseSummary} from "@/lib/types";

type LinkHubsSettingsPanelProps = {
  initialHubs: LinkHubRecord[];
  releaseOptions: ReleaseSummary[];
};

export function LinkHubsSettingsPanel({
  initialHubs,
  releaseOptions
}: LinkHubsSettingsPanelProps) {
  const [hubs, setHubs] = useState<LinkHubRecord[]>(initialHubs);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteUrl(window.location.origin);
    }
  }, []);

  function getNextAvailablePath() {
    let num = 2;
    while (hubs.some((h) => h.path === `links${num}`)) {
      num++;
    }
    return `links${num}`;
  }

  function handleAddHub() {
    const nextPath = getNextAvailablePath();
    const nextSortOrder = hubs.length > 0 ? Math.max(...hubs.map((h) => h.sortOrder)) + 1 : 0;
    const newHub: LinkHubRecord = {
      id: `new-${Date.now()}`,
      path: nextPath,
      releaseId: releaseOptions[0]?.id || null,
      isEnabled: true,
      showInPublicNav: false,
      label: `Links ${nextPath.replace("links", "") || "1"}`,
      sortOrder: nextSortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setHubs((current) => [...current, newHub]);
  }

  function handleUpdateField<K extends keyof LinkHubRecord>(
    id: string,
    field: K,
    value: LinkHubRecord[K]
  ) {
    setHubs((current) =>
      current.map((h) => {
        if (h.id !== id) {
          return h;
        }
        return {
          ...h,
          [field]: value
        };
      })
    );
    // Reset save state for this row on edit
    setSaveState((prev) => ({...prev, [id]: "idle"}));
  }

  async function handleSaveHub(hub: LinkHubRecord) {
    const id = hub.id;
    setSaveState((prev) => ({...prev, [id]: "saving"}));
    setErrorMessages((prev) => ({...prev, [id]: ""}));

    try {
      const isNew = id.startsWith("new-");
      const cleanHub = {
        ...hub,
        id: isNew ? undefined : id // API will generate new ID if undefined
      };

      const response = await fetch("/api/link-hubs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(cleanHub)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to save link hub.");
      }

      setSaveState((prev) => ({...prev, [id]: "saved"}));
      
      // Update hubs list with the saved record (specifically to get actual DB ID if it was new)
      if (isNew && payload.record) {
        setHubs((current) =>
          current.map((h) => (h.id === id ? {
            ...payload.record,
            release_title: releaseOptions.find((r) => r.id === payload.record.releaseId)?.title
          } : h))
        );
      } else {
        setHubs((current) =>
          current.map((h) => (h.id === id ? {
            ...h,
            release_title: releaseOptions.find((r) => r.id === h.releaseId)?.title
          } : h))
        );
      }

      setTimeout(() => {
        setSaveState((prev) => ({...prev, [id]: "idle"}));
      }, 3000);
    } catch (err: any) {
      setSaveState((prev) => ({...prev, [id]: "error"}));
      setErrorMessages((prev) => ({...prev, [id]: err.message || "Error saving."}));
    }
  }

  async function handleDeleteHub(id: string, path: string) {
    if (id.startsWith("new-")) {
      setHubs((current) => current.filter((h) => h.id !== id));
      return;
    }

    const shouldDelete = window.confirm(
      `Are you sure you want to delete /${path}? Campaign analytics for this slug will remain but the path will no longer be accessible.`
    );
    if (!shouldDelete) return;

    try {
      const response = await fetch(`/api/link-hubs?id=${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || "Failed to delete link hub.");
      }

      setHubs((current) => current.filter((h) => h.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete link hub.");
    }
  }

  function handleCopyUrl(path: string, id: string) {
    const url = `${siteUrl}/${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <section className="panel space-y-6 px-6 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="pill">
            <Link2 size={12} />
            Link Hubs
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Multi-Link Campaign Landing Pages
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Manage your `/links` landing pages. The primary `/links` hub falls back to the latest release.
            Create additional campaign pages (e.g. `/links2`, `/links3`) mapped to specific releases.
          </p>
        </div>

        <button className="action-button-primary" onClick={handleAddHub} type="button">
          <Plus size={16} />
          Create Hub
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-[#272b31] bg-[#101215] overflow-hidden">
        {hubs.length === 0 ? (
          <div className="p-12 text-center text-[#8f959d]">
            No Link Hub entries yet. Click &quot;Create Hub&quot; to seed the default `/links`.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#ece6da]">
              <thead className="border-b border-[#272b31] bg-[#16191d] text-[#8f959d]">
                <tr>
                  <th className="px-4 py-4 font-semibold w-1/6">Path</th>
                  <th className="px-4 py-4 font-semibold w-1/4">Assigned Release</th>
                  <th className="px-4 py-4 font-semibold w-1/6">Label</th>
                  <th className="px-4 py-4 font-semibold text-center w-24">Enabled</th>
                  <th className="px-4 py-4 font-semibold text-center w-28">Public Nav</th>
                  <th className="px-4 py-4 font-semibold text-center w-20">Sort</th>
                  <th className="px-4 py-4 font-semibold text-right w-64">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#272b31]">
                {hubs.map((hub) => {
                  const isPrimary = hub.path === "links";
                  const isNew = hub.id.startsWith("new-");
                  const publicUrl = `${siteUrl}/${hub.path}`;
                  const rowState = saveState[hub.id] || "idle";
                  const rowError = errorMessages[hub.id] || "";

                  return (
                    <tr className="transition hover:bg-[#16191d] align-middle" key={hub.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#8f959d]">/</span>
                          <input
                            className="field-input py-1.5 px-2 bg-transparent text-sm w-full min-w-[80px]"
                            disabled={isPrimary}
                            onChange={(e) => handleUpdateField(hub.id, "path", e.target.value)}
                            placeholder="links2"
                            value={hub.path}
                          />
                        </div>
                        {rowError && (
                          <span className="block mt-1 text-xs text-rose-400 break-words max-w-[150px]">
                            {rowError}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <select
                          className="field-input py-1.5 px-2 text-sm bg-[#121418] text-[#ece6da] border-[#30343b] w-full"
                          onChange={(e) => handleUpdateField(hub.id, "releaseId", e.target.value || null)}
                          value={hub.releaseId || ""}
                        >
                          {isPrimary && (
                            <option className="bg-[#121418] text-[#ece6da]" value="">
                              Latest Release (Fallback)
                            </option>
                          )}
                          {!isPrimary && (
                            <option className="bg-[#121418] text-muted" disabled value="">
                              Select Release...
                            </option>
                          )}
                          {releaseOptions.map((r) => (
                            <option className="bg-[#121418] text-[#ece6da]" key={r.id} value={r.id}>
                              {r.title} ({r.status})
                            </option>
                          ))}
                        </select>
                        {isPrimary && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8f959d]">
                            If no release is assigned, /links falls back to the legacy/default featured release.
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="field-input py-1.5 px-2 bg-transparent text-sm w-full min-w-[100px]"
                          onChange={(e) => handleUpdateField(hub.id, "label", e.target.value)}
                          placeholder="Links"
                          value={hub.label || ""}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          checked={hub.isEnabled}
                          className="h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347] disabled:opacity-40"
                          disabled={isPrimary}
                          onChange={(e) => handleUpdateField(hub.id, "isEnabled", e.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          checked={hub.showInPublicNav}
                          className="h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347] disabled:opacity-40"
                          disabled={isPrimary}
                          onChange={(e) => handleUpdateField(hub.id, "showInPublicNav", e.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          className="field-input py-1.5 px-2 bg-transparent text-sm w-16 text-center"
                          onChange={(e) => handleUpdateField(hub.id, "sortOrder", Number(e.target.value) || 0)}
                          type="number"
                          value={hub.sortOrder}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#ece6da] hover:bg-white/10 hover:text-white transition disabled:opacity-40"
                            disabled={isNew}
                            onClick={() => handleCopyUrl(hub.path, hub.id)}
                            title="Copy URL"
                            type="button"
                          >
                            {copiedId === hub.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                          <a
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#ece6da] hover:bg-white/10 hover:text-white transition ${isNew ? "pointer-events-none opacity-40" : ""}`}
                            href={isNew ? "#" : publicUrl}
                            rel="noreferrer"
                            target="_blank"
                            title="Open URL"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            className="inline-flex h-9 px-3 items-center justify-center gap-1.5 rounded-lg border border-[#3e454f] bg-white/5 text-[#ece6da] hover:bg-white/10 transition"
                            onClick={() => void handleSaveHub(hub)}
                            type="button"
                          >
                            <Save size={14} />
                            <span className="text-xs font-semibold">
                              {rowState === "saving" ? "Saving..." : rowState === "saved" ? "Saved!" : "Save"}
                            </span>
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition disabled:opacity-20"
                            disabled={isPrimary}
                            onClick={() => void handleDeleteHub(hub.id, hub.path)}
                            title="Delete Hub"
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
