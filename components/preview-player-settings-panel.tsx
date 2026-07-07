"use client";

import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Music,
  CheckCircle,
  AlertTriangle,
  X,
  Edit2
} from "lucide-react";
import {useState} from "react";

import type {UpcomingPreviewTrack, ReleaseSummary, SiteSettingsRecord} from "@/lib/types";
import {createId} from "@/lib/utils";

type PreviewPlayerSettingsPanelProps = {
  settings: SiteSettingsRecord["site_content"]["preview_player"];
  releaseOptions: ReleaseSummary[];
  onChange: (settings: SiteSettingsRecord["site_content"]["preview_player"]) => void;
};

export function PreviewPlayerSettingsPanel({
  settings,
  releaseOptions,
  onChange
}: PreviewPlayerSettingsPanelProps) {
  const isEnabled = settings.is_enabled;
  const tracks = settings.tracks || [];

  const [editingTrack, setEditingTrack] = useState<UpcomingPreviewTrack | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");

  function updateSettings(patch: Partial<typeof settings>) {
    onChange({
      is_enabled: isEnabled,
      tracks: tracks,
      ...patch
    });
  }

  function handleToggleEnabled() {
    updateSettings({is_enabled: !isEnabled});
  }

  function handleAddTrack() {
    const newTrack: UpcomingPreviewTrack = {
      id: createId(),
      releaseId: "",
      titleOverride: "",
      artworkUrlOverride: "",
      audioUrl: "",
      isActive: true,
      sortOrder: tracks.length
    };
    const updated = [...tracks, newTrack];
    updateSettings({tracks: updated});
    setEditingTrack(newTrack);
  }

  function handleEditTrack(track: UpcomingPreviewTrack) {
    setEditingTrack({...track});
  }

  function handleDeleteTrack(trackId: string) {
    if (!confirm("Are you sure you want to delete this preview track?")) return;
    const updated = tracks
      .filter((t) => t.id !== trackId)
      .map((t, idx) => ({...t, sortOrder: idx}));
    updateSettings({tracks: updated});
  }

  function handleMoveTrack(idx: number, direction: "up" | "down") {
    const updated = [...tracks];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tracks.length) return;

    // Swap
    const temp = updated[idx]!;
    updated[idx] = updated[targetIdx]!;
    updated[targetIdx] = temp;

    // Re-assign sortOrder
    const finalized = updated.map((t, index) => ({...t, sortOrder: index}));
    updateSettings({tracks: finalized});
  }

  function handleSaveEditing(updatedTrack: UpcomingPreviewTrack) {
    const updated = tracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t));
    updateSettings({tracks: updated});
    setEditingTrack(null);
    setUploadMessage("");
  }

  // File Upload Helper
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "track" | "art") {
    const file = e.target.files?.[0];
    if (!file || !editingTrack) return;

    setUploadState("uploading");
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", type);

      const prevUrl = type === "track" ? editingTrack.audioUrl : editingTrack.artworkUrlOverride;
      if (prevUrl) {
        formData.append("previousPath", prevUrl);
      }

      const res = await fetch("/api/admin/previews/upload", {
        method: "POST",
        body: formData
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || "Failed to upload file.");
      }

      if (type === "track") {
        setEditingTrack({
          ...editingTrack,
          audioUrl: payload.storedPath
        });
      } else {
        setEditingTrack({
          ...editingTrack,
          artworkUrlOverride: payload.storedPath
        });
      }
      setUploadState("success");
      setUploadMessage(`${type === "track" ? "Audio file" : "Artwork image"} uploaded successfully!`);
    } catch (err: any) {
      setUploadState("error");
      setUploadMessage(err.message || "Upload failed.");
    }
  }

  // Active track count rules
  const activeCount = tracks.filter((t) => t.isActive).length;

  return (
    <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c9a347]">
            Section 11
          </span>
          <h3 className="mt-2 text-2xl font-semibold text-ink">Upcoming Music Preview Player</h3>
          <p className="mt-1 text-sm text-[#8d949d]">
            Manage unreleased audio previews cycling in the persistent bottom site layout.
          </p>
        </div>

        <button
          className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
            isEnabled
              ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
              : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
          }`}
          onClick={handleToggleEnabled}
          type="button"
        >
          <span>{isEnabled ? "Player Enabled" : "Player Disabled"}</span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${isEnabled ? "bg-[#d7b45e]" : "bg-neutral-500"}`}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="space-y-4">
          {/* Count warnings */}
          {activeCount === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle size={18} />
              <span>No active tracks configured. The preview player will not render.</span>
            </div>
          ) : activeCount === 1 || activeCount === 2 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm text-[#d7b45e]">
              <AlertTriangle size={18} />
              <span>
                You have {activeCount} active track{activeCount > 1 ? "s" : ""}. 3-5 active tracks
                are recommended for a full experience.
              </span>
            </div>
          ) : activeCount >= 3 && activeCount <= 5 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle size={18} />
              <span>Perfect! You have {activeCount} active preview tracks.</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle size={18} />
              <span>
                <strong>Warning:</strong> You have {activeCount} active tracks. Site Settings save
                will be rejected (maximum is 5 active tracks).
              </span>
            </div>
          )}

          {/* Tracks list */}
          <div className="overflow-hidden rounded-2xl border border-[#30343b] bg-[#0f1217]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[#30343b] bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-[#7c838c]">
                <tr>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Track Info</th>
                  <th className="px-4 py-3">Media URL / Path</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30343b]">
                {tracks.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-[#7c838c]" colSpan={4}>
                      No preview tracks added yet.
                    </td>
                  </tr>
                ) : (
                  tracks.map((track, idx) => {
                    const linkedRel = releaseOptions.find((r) => r.id === track.releaseId);
                    const title = track.titleOverride || linkedRel?.title || "Untitled Track";
                    const isTooMany = activeCount > 5 && track.isActive;

                    return (
                      <tr
                        key={track.id}
                        className={`transition hover:bg-white/[0.01] ${
                          track.isActive ? "" : "opacity-60"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            checked={track.isActive}
                            className="h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347]"
                            onChange={() => {
                              const updated = tracks.map((t) =>
                                t.id === track.id ? {...t, isActive: !t.isActive} : t
                              );
                              updateSettings({tracks: updated});
                            }}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-[#f3eddf]">
                          <div className="flex flex-col">
                            <span>{title}</span>
                            {linkedRel && (
                              <span className="text-xs text-[#c9a347]">
                                Linked: {linkedRel.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#7c838c] max-w-[240px] truncate">
                          {track.audioUrl || <span className="text-rose-400">No audio file</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="rounded p-2 text-[#a1a7b0] hover:bg-white/5 hover:text-ink disabled:opacity-30"
                              disabled={idx === 0}
                              onClick={() => handleMoveTrack(idx, "up")}
                              title="Move Up"
                              type="button"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              className="rounded p-2 text-[#a1a7b0] hover:bg-white/5 hover:text-ink disabled:opacity-30"
                              disabled={idx === tracks.length - 1}
                              onClick={() => handleMoveTrack(idx, "down")}
                              title="Move Down"
                              type="button"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              className="rounded p-2 text-[#c9a347] hover:bg-[#c9a347]/10"
                              onClick={() => handleEditTrack(track)}
                              title="Edit"
                              type="button"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="rounded p-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                              onClick={() => handleDeleteTrack(track.id)}
                              title="Delete"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <button
            className="flex items-center gap-2 rounded-full border border-[#c9a347]/40 bg-[#c9a347]/10 px-5 py-2.5 text-sm font-semibold text-[#f2dfb0] transition hover:border-[#c9a347]/60 hover:bg-[#c9a347]/20"
            onClick={handleAddTrack}
            type="button"
          >
            <Plus size={16} />
            Add Preview Track
          </button>
        </div>
      )}

      {/* Editing modal */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-[#30343b] bg-[#121418] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-semibold text-ink">Edit Preview Track</h4>
              <button
                className="rounded-full p-2 text-[#a1a7b0] hover:bg-white/5 hover:text-ink"
                onClick={() => setEditingTrack(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 space-y-0 rounded-2xl border border-[#30343b] bg-[#15181c] px-4 py-3">
                <input
                  checked={editingTrack.isActive}
                  className="h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347]"
                  onChange={(e) => setEditingTrack({...editingTrack, isActive: e.target.checked})}
                  type="checkbox"
                />
                <span className="text-sm font-medium text-[#d5d9df]">Track is active</span>
              </label>

              <label className="block space-y-2">
                <span className="field-label">Linked Release (Optional)</span>
                <select
                  className="field-input"
                  onChange={(e) => setEditingTrack({...editingTrack, releaseId: e.target.value})}
                  value={editingTrack.releaseId || ""}
                >
                  <option value="">No release linked</option>
                  {releaseOptions.map((rel) => (
                    <option key={rel.id} value={rel.id}>
                      {rel.title} ({rel.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">
                  Linking a release derives its Title and Artwork cover automatically.
                </p>
              </label>

              <label className="block space-y-2">
                <span className="field-label">Title Override</span>
                <input
                  className="field-input"
                  onChange={(e) => setEditingTrack({...editingTrack, titleOverride: e.target.value})}
                  placeholder="Leave blank to use linked release title"
                  value={editingTrack.titleOverride || ""}
                />
              </label>

              <label className="block space-y-2">
                <span className="field-label">Artwork URL / Override</span>
                <input
                  className="field-input"
                  onChange={(e) =>
                    setEditingTrack({...editingTrack, artworkUrlOverride: e.target.value})
                  }
                  placeholder="Leave blank to use linked release artwork"
                  value={editingTrack.artworkUrlOverride || ""}
                />
                <div className="flex items-center gap-3">
                  <input
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    id="art-upload"
                    onChange={(e) => void handleFileUpload(e, "art")}
                    type="file"
                  />
                  <label
                    className="inline-flex items-center gap-2 cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-ink hover:bg-white/[0.08]"
                    htmlFor="art-upload"
                  >
                    <Upload size={12} />
                    Upload Image
                  </label>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="field-label">Audio Track URL</span>
                <input
                  className="field-input"
                  onChange={(e) => setEditingTrack({...editingTrack, audioUrl: e.target.value})}
                  placeholder="HTTPS URL or local path e.g. /api/assets/..."
                  value={editingTrack.audioUrl}
                />
                <div className="flex items-center gap-3">
                  <input
                    accept=".mp3,.wav,.m4a"
                    className="hidden"
                    id="audio-upload"
                    onChange={(e) => void handleFileUpload(e, "track")}
                    type="file"
                  />
                  <label
                    className="inline-flex items-center gap-2 cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-ink hover:bg-white/[0.08]"
                    htmlFor="audio-upload"
                  >
                    <Music size={12} />
                    Upload Track File
                  </label>
                </div>
              </label>

              {uploadMessage && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-xs ${
                    uploadState === "error"
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  }`}
                >
                  {uploadMessage}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                className="rounded-full border border-[#30343b] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#d5d9df] hover:bg-white/5"
                onClick={() => setEditingTrack(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-gradient-to-r from-[#c9a347] to-[#e6c167] px-5 py-2.5 text-sm font-bold text-[#13161a]"
                onClick={() => handleSaveEditing(editingTrack)}
                type="button"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
