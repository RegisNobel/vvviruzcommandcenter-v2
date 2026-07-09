"use client";

import {useState, useTransition} from "react";
import Link from "next/link";
import {Music, ExternalLink} from "lucide-react";
import type {PlaylistRecord} from "@/lib/types";

export function PlaylistsSettingsPanel({
  initialPlaylists
}: {
  initialPlaylists: PlaylistRecord[];
}) {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");

  const handleTogglePublic = (id: string, currentPublic: boolean) => {
    setErrorMsg("");
    const newPublic = !currentPublic;

    // Optimistic update
    setPlaylists((current) =>
      current.map((p) => (p.id === id ? {...p, isPublic: newPublic} : p))
    );

    startTransition(async () => {
      try {
        const response = await fetch(`/api/playlists/${id}`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            // Send full payload to schema validation
            ...playlists.find((p) => p.id === id),
            isPublic: newPublic
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to update visibility.");
        }

        const data = await response.json();
        // Update with actual DB response
        setPlaylists((current) =>
          current.map((p) => (p.id === id ? data.playlist : p))
        );
      } catch (err) {
        // Rollback
        setPlaylists((current) =>
          current.map((p) => (p.id === id ? {...p, isPublic: currentPublic} : p))
        );
        setErrorMsg(err instanceof Error ? err.message : "Failed to toggle visibility.");
      }
    });
  };

  return (
    <section className="panel space-y-6 px-6 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="pill">
            <Music size={12} />
            Playlists
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Playlist Landing Pages
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Configure public visibility for streaming playlist campaigns. Turning a playlist off returns a 404.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="table-surface mt-8">
        {playlists.length === 0 ? (
          <div className="p-12 text-center text-muted">
            No playlists found. Create one in Promo &rarr; Playlists.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-ink">
            <thead className="border-b border-edge bg-surface-elevated text-secondary">
              <tr>
                <th className="px-6 py-4 font-semibold">Playlist</th>
                <th className="px-6 py-4 font-semibold">Slug</th>
                <th className="px-6 py-4 font-semibold">Public URL</th>
                <th className="px-6 py-4 font-semibold">Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {playlists.map((playlist) => (
                <tr className="transition hover:bg-surface-hover" key={playlist.id}>
                  <td className="px-6 py-4 font-semibold text-ink">
                    {playlist.name}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {playlist.slug}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline"
                      href={`/listen/${playlist.slug}`}
                      target="_blank"
                    >
                      /listen/{playlist.slug}
                      <ExternalLink size={12} />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        checked={playlist.isPublic}
                        className="sr-only peer"
                        disabled={isPending}
                        onChange={() => handleTogglePublic(playlist.id, playlist.isPublic)}
                        type="checkbox"
                      />
                      <div className="toggle-control peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/30"></div>
                      <span className="ml-2 text-xs text-muted">
                        {playlist.isPublic ? "Public" : "Private"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
