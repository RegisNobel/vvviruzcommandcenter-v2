"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";
import {Archive, Loader2, RotateCcw, Search, Trash2} from "lucide-react";

import type {AppearsOnRecord} from "@/lib/types";
import {
  deleteAppearsOnAction,
  resolveSpotifyUrlAction,
  saveAppearsOnAction,
  setAppearsOnArchivedAction
} from "@/app/admin/(protected)/appears-on/actions";

export function AppearsOnForm({initialRecord}: {initialRecord?: AppearsOnRecord}) {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [saveError, setSaveError] = useState("");
  
  const [record, setRecord] = useState<Partial<AppearsOnRecord>>(initialRecord || {
    title: "",
    artists: "",
    cover_art_url: "",
    spotify_url: "",
    apple_music_url: "",
    youtube_music_url: "",
    youtube_url: "",
    release_date: null,
    is_published: false,
    archived_at: null,
    sort_order: 0
  });
  const isArchived = Boolean(record.archived_at);

  const handleResolve = async () => {
    if (!record.spotify_url) return;
    setIsResolving(true);
    setResolveError("");
    
    const result = await resolveSpotifyUrlAction(record.spotify_url);
    if (!result.ok) {
      setResolveError(
        result.message || "Spotify could not be resolved. Check the URL and try again."
      );
    } else if (result.data) {
      const resolution = result.data;
      setRecord(prev => ({
        ...prev,
        title: prev.title || resolution.title,
        artists: prev.artists || resolution.artists,
        cover_art_url: prev.cover_art_url || resolution.coverArtUrl,
        apple_music_url: prev.apple_music_url || resolution.appleMusicUrl,
        youtube_music_url: prev.youtube_music_url || resolution.youtubeMusicUrl,
        youtube_url: prev.youtube_url || resolution.youtubeUrl,
      }));
    } else {
      setResolveError("Spotify returned no track details. Check the URL and try again.");
    }
    
    setIsResolving(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      const result = await saveAppearsOnAction(record);
      if (!result.ok) {
        setSaveError(result.message || "This appearance could not be saved.");
        setIsSaving(false);
        return;
      }
      router.push("/admin/site#appears-on");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this appearance.");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialRecord || !confirm("Permanently delete this appearance? Archive it instead if you want to preserve the record.")) return;
    setIsSaving(true);
    const result = await deleteAppearsOnAction(initialRecord.id);
    if (!result.ok) {
      setSaveError(result.message || "This appearance could not be deleted.");
      setIsSaving(false);
      return;
    }
    router.push("/admin/site");
    router.refresh();
  };

  const handleArchive = async (archived: boolean) => {
    if (!initialRecord) return;
    const confirmed = archived
      ? confirm("Archive this appearance? It will leave the public music page but remain available in Public Site settings and backups.")
      : true;
    if (!confirmed) return;

    setIsSaving(true);
    const result = await setAppearsOnArchivedAction(initialRecord.id, archived);
    if (!result.ok) {
      setSaveError(
        result.message || `This appearance could not be ${archived ? "archived" : "restored"}.`
      );
      setIsSaving(false);
      return;
    }
    router.push("/admin/site#appears-on");
    router.refresh();
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div className="command-surface overflow-hidden">
        <div className="border-b border-edge bg-input px-5 py-4 sm:px-6">
          <p className="field-label">Resolve via Spotify</p>
          <p className="mt-2 text-sm text-muted">
            Paste a Spotify URL to automatically pull metadata and links via Odesli.
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="field-input flex-1"
              placeholder="https://open.spotify.com/track/..."
              value={record.spotify_url}
              onChange={(e) => setRecord({...record, spotify_url: e.target.value})}
            />
            <button
              className="action-button-primary disabled:opacity-50"
              disabled={!record.spotify_url || isResolving}
              onClick={handleResolve}
            >
              {isResolving ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Resolve
            </button>
          </div>
          {resolveError && <p className="mt-3 text-sm text-rose-300">{resolveError}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="command-surface flex-1 space-y-6 p-5 sm:p-6">
          <div className="space-y-4">
            <div>
              <label className="field-label mb-2 block">Title</label>
              <input
                className="field-input"
                value={record.title}
                onChange={(e) => setRecord({...record, title: e.target.value})}
              />
            </div>
            <div>
              <label className="field-label mb-2 block">Artists</label>
              <input
                className="field-input"
                value={record.artists}
                onChange={(e) => setRecord({...record, artists: e.target.value})}
              />
            </div>
            <div>
              <label className="field-label mb-2 block">Cover Art URL</label>
              <input
                className="field-input"
                value={record.cover_art_url}
                onChange={(e) => setRecord({...record, cover_art_url: e.target.value})}
              />
            </div>
            <div>
              <label className="field-label mb-2 block">Release Date (optional)</label>
              <input
                className="field-input"
                type="date"
                value={record.release_date || ""}
                onChange={(e) => setRecord({...record, release_date: e.target.value || null})}
              />
              <p className="mt-2 text-xs leading-5 text-muted">
                Odesli does not reliably provide release dates, so add this manually when known.
              </p>
            </div>
          </div>
          
          <div className="space-y-4 border-t border-edge pt-6">
            <h3 className="text-lg font-semibold text-ink">Links</h3>
            <div>
              <label className="field-label mb-2 block">Apple Music URL</label>
              <input
                className="field-input"
                value={record.apple_music_url}
                onChange={(e) => setRecord({...record, apple_music_url: e.target.value})}
              />
            </div>
            <div>
              <label className="field-label mb-2 block">YouTube Music URL</label>
              <input
                className="field-input"
                value={record.youtube_music_url}
                onChange={(e) => setRecord({...record, youtube_music_url: e.target.value})}
              />
            </div>
            <div>
              <label className="field-label mb-2 block">YouTube Video URL</label>
              <input
                className="field-input"
                value={record.youtube_url}
                onChange={(e) => setRecord({...record, youtube_url: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6">
          <div className="command-surface p-5 sm:p-6">
            <h3 className="mb-4 font-semibold text-ink">Preview</h3>
            <div className="flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-edge bg-input text-center">
              {record.cover_art_url ? (
                <div className="relative w-full h-full">
                  <Image 
                    src={record.cover_art_url} 
                    alt="Cover Art" 
                    fill 
                    className="object-cover" 
                    unoptimized 
                  />
                </div>
              ) : (
                <p className="px-4 text-sm text-muted">No Cover Art</p>
              )}
            </div>
            <div className="mt-4 text-center">
              <p className="truncate font-semibold text-ink">{record.title || "Untitled"}</p>
              <p className="truncate text-sm text-muted">{record.artists || "Artist"}</p>
            </div>
          </div>

          <div className="command-surface space-y-4 p-5 sm:p-6">
            {isArchived ? <div className="status-badge-neutral w-fit">Archived</div> : null}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-edge bg-input text-brand-primary focus:ring-brand-primary focus:ring-offset-surface"
                checked={record.is_published}
                disabled={isArchived}
                onChange={(e) => setRecord({...record, is_published: e.target.checked})}
              />
              <span className="font-semibold text-ink">Published</span>
            </label>
            <p className="text-xs leading-5 text-muted">
              Publishing requires resolved title, artist, cover art, and Spotify URL.
              Archived records restore as Drafts.
            </p>
            
            <div>
              <label className="field-label mb-2 block">Display Order</label>
              <input
                type="number"
                className="field-input"
                value={record.sort_order}
                onChange={(e) => setRecord({...record, sort_order: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          {saveError ? (
            <p className="rounded-lg border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              {saveError}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              className="action-button-primary flex-1 py-3 disabled:opacity-50"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : "Save Appearance"}
            </button>
            {initialRecord && (
              <button
                className="action-button-secondary px-4 py-3 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => handleArchive(!isArchived)}
                title={isArchived ? "Restore to Draft" : "Archive appearance"}
              >
                {isArchived ? <RotateCcw size={20}/> : <Archive size={20}/>}
              </button>
            )}
            {initialRecord && (
              <button
                className="action-button-danger px-4 py-3 disabled:opacity-50"
                disabled={isSaving}
                onClick={handleDelete}
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
