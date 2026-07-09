"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";
import {Loader2, Search, Trash2} from "lucide-react";

import type {AppearsOnRecord} from "@/lib/types";
import {resolveSpotifyUrlAction, saveAppearsOnAction, deleteAppearsOnAction} from "@/app/admin/(protected)/appears-on/actions";

export function AppearsOnForm({initialRecord}: {initialRecord?: AppearsOnRecord}) {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  
  const [record, setRecord] = useState<Partial<AppearsOnRecord>>(initialRecord || {
    title: "",
    artists: "",
    cover_art_url: "",
    spotify_url: "",
    apple_music_url: "",
    youtube_music_url: "",
    youtube_url: "",
    is_published: false,
    sort_order: 0
  });

  const handleResolve = async () => {
    if (!record.spotify_url) return;
    setIsResolving(true);
    setResolveError("");
    
    const result = await resolveSpotifyUrlAction(record.spotify_url);
    if (result) {
      setRecord(prev => ({
        ...prev,
        title: prev.title || result.title,
        artists: prev.artists || result.artists,
        cover_art_url: prev.cover_art_url || result.coverArtUrl,
        apple_music_url: prev.apple_music_url || result.appleMusicUrl,
        youtube_music_url: prev.youtube_music_url || result.youtubeMusicUrl,
        youtube_url: prev.youtube_url || result.youtubeUrl,
      }));
    } else {
      setResolveError("Failed to resolve links from Odesli. Check the URL and try again.");
    }
    
    setIsResolving(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveAppearsOnAction(record);
    router.push("/admin/site");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!initialRecord || !confirm("Are you sure you want to delete this?")) return;
    setIsSaving(true);
    await deleteAppearsOnAction(initialRecord.id);
    router.push("/admin/site");
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
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-edge bg-input text-brand-primary focus:ring-brand-primary focus:ring-offset-surface"
                checked={record.is_published}
                onChange={(e) => setRecord({...record, is_published: e.target.checked})}
              />
              <span className="font-semibold text-ink">Published</span>
            </label>
            
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

          <div className="flex gap-3">
            <button
              className="action-button-primary flex-1 py-3 disabled:opacity-50"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : "Save Feature"}
            </button>
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
