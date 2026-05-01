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
    <div className="space-y-8 max-w-4xl">
      <div className="rounded-2xl border border-[#272b31] bg-[#101215] overflow-hidden">
        <div className="border-b border-[#272b31] bg-[#16191d] px-6 py-4">
          <h2 className="text-sm font-semibold text-[#ece6da]">Resolve via Spotify</h2>
          <p className="mt-1 text-sm text-[#8f959d]">
            Paste a Spotify URL to automatically pull metadata and links via Odesli.
          </p>
        </div>
        <div className="p-6">
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] placeholder:text-[#545962] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
              placeholder="https://open.spotify.com/track/..."
              value={record.spotify_url}
              onChange={(e) => setRecord({...record, spotify_url: e.target.value})}
            />
            <button
              className="flex items-center gap-2 rounded-xl bg-[#c9a347] px-5 py-2.5 font-semibold text-[#13161a] hover:bg-[#d7b663] disabled:opacity-50"
              disabled={!record.spotify_url || isResolving}
              onClick={handleResolve}
            >
              {isResolving ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              Resolve
            </button>
          </div>
          {resolveError && <p className="mt-2 text-sm text-red-500">{resolveError}</p>}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6 rounded-2xl border border-[#272b31] bg-[#101215] p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">Title</label>
              <input
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.title}
                onChange={(e) => setRecord({...record, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">Artists</label>
              <input
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.artists}
                onChange={(e) => setRecord({...record, artists: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">Cover Art URL</label>
              <input
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.cover_art_url}
                onChange={(e) => setRecord({...record, cover_art_url: e.target.value})}
              />
            </div>
          </div>
          
          <div className="space-y-4 border-t border-[#272b31] pt-6">
            <h3 className="font-semibold text-[#ece6da]">Links</h3>
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">Apple Music URL</label>
              <input
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.apple_music_url}
                onChange={(e) => setRecord({...record, apple_music_url: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">YouTube Music URL</label>
              <input
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.youtube_music_url}
                onChange={(e) => setRecord({...record, youtube_music_url: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">YouTube Video URL</label>
              <input
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.youtube_url}
                onChange={(e) => setRecord({...record, youtube_url: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-6">
          <div className="rounded-2xl border border-[#272b31] bg-[#101215] p-6">
            <h3 className="font-semibold text-[#ece6da] mb-4">Preview</h3>
            <div className="aspect-square w-full rounded-xl border border-[#272b31] bg-[#16191d] overflow-hidden flex flex-col items-center justify-center text-center">
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
                <p className="text-sm text-[#545962] px-4">No Cover Art</p>
              )}
            </div>
            <div className="mt-4 text-center">
              <p className="font-semibold text-[#ece6da] truncate">{record.title || "Untitled"}</p>
              <p className="text-sm text-[#8f959d] truncate">{record.artists || "Artist"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#272b31] bg-[#101215] p-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-[#30343b] bg-[#0c0d10] text-[#c9a347] focus:ring-[#c9a347] focus:ring-offset-[#101215]"
                checked={record.is_published}
                onChange={(e) => setRecord({...record, is_published: e.target.checked})}
              />
              <span className="font-semibold text-[#ece6da]">Published</span>
            </label>
            
            <div>
              <label className="block text-sm font-semibold text-[#ece6da] mb-1.5">Display Order</label>
              <input
                type="number"
                className="w-full rounded-xl border border-[#30343b] bg-[#0c0d10] px-4 py-2.5 text-[#ece6da] focus:border-[#c9a347] focus:outline-none focus:ring-1 focus:ring-[#c9a347]"
                value={record.sort_order}
                onChange={(e) => setRecord({...record, sort_order: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 rounded-xl bg-[#c9a347] py-3 font-semibold text-[#13161a] hover:bg-[#d7b663] disabled:opacity-50"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : "Save Feature"}
            </button>
            {initialRecord && (
              <button
                className="flex items-center justify-center rounded-xl border border-[#7b3e3e] bg-[#341919] px-4 py-3 text-[#f0d7d2] hover:bg-[#452020] disabled:opacity-50"
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
