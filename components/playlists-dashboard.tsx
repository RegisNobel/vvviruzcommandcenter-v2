"use client";

import {useState, useTransition, useMemo, useEffect} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {
  Music,
  Plus,
  Eye,
  EyeOff,
  Archive,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  Edit2
} from "lucide-react";
import type {PlaylistRecord} from "@/lib/types";
import {slugify} from "@/lib/utils";

export function PlaylistsDashboard({
  initialPlaylists,
  baseUrl,
  initialStatusFilter
}: {
  initialPlaylists: PlaylistRecord[];
  baseUrl: string;
  initialStatusFilter: "ACTIVE" | "ARCHIVED";
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState("");
  const [message, setMessage] = useState("");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [primaryPlatform, setPrimaryPlatform] = useState("spotify");
  const [isPublic, setIsPublic] = useState(false);

  // Sync playlists state when initialPlaylists updates (due to router.refresh)
  useEffect(() => {
    setPlaylists(initialPlaylists);
  }, [initialPlaylists]);

  // Sync route query parameter on filter change
  const handleFilterChange = (filter: "ACTIVE" | "ARCHIVED") => {
    setStatusFilter(filter);
    router.push(`/admin/promo/playlists?status=${filter}`);
  };

  // Auto slug generation on name change
  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(slugify(val));
  };

  const handleCopyLink = async (playlist: PlaylistRecord) => {
    const fullUrl = `${baseUrl.replace(/\/+$/g, "")}/listen/${playlist.slug}`;
    await navigator.clipboard?.writeText(fullUrl);
    setCopiedId(playlist.id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const handleTogglePublic = (playlist: PlaylistRecord) => {
    const newPublic = !playlist.isPublic;
    // Optimistic update
    setPlaylists((current) =>
      current.map((p) => (p.id === playlist.id ? {...p, isPublic: newPublic} : p))
    );

    startTransition(async () => {
      try {
        const response = await fetch(`/api/playlists/${playlist.id}`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            ...playlist,
            isPublic: newPublic
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || "Failed to update visibility.");
        }
        router.refresh();
      } catch (err) {
        // Revert
        setPlaylists((current) =>
          current.map((p) => (p.id === playlist.id ? {...p, isPublic: playlist.isPublic} : p))
        );
        setMessage(err instanceof Error ? err.message : "Failed to toggle visibility.");
      }
    });
  };

  const handleArchive = (id: string) => {
    if (!confirm("Are you sure you want to archive this playlist? All public routes will return 404.")) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/playlists/${id}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || "Failed to archive playlist.");
        }
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to archive playlist.");
      }
    });
  };

  const handleRestore = (playlist: PlaylistRecord) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/playlists/${playlist.id}`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            ...playlist,
            isArchived: false
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message || "Failed to restore playlist.");
        }
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to restore playlist.");
      }
    });
  };

  const handleCreate = () => {
    setMessage("");
    if (!name.trim()) {
      setMessage("Name is required.");
      return;
    }
    if (!slug.trim()) {
      setMessage("Slug is required.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/playlists", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            name,
            slug,
            description,
            coverImageUrl,
            primaryPlatform,
            isPublic
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to create playlist.");
        }

        // Reset state
        setName("");
        setSlug("");
        setDescription("");
        setCoverImageUrl("");
        setPrimaryPlatform("spotify");
        setIsPublic(false);
        setShowCreateModal(false);

        router.push(`/admin/promo/playlists/${data.playlist.id}`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to create playlist.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <section className="panel px-4 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="pill">
              <Music size={12} />
              Promo
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Playlists
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Manage campaign landing pages and follow links for streaming playlists.
            </p>
          </div>
          <button
            className="action-button-primary inline-flex items-center gap-1.5"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create Playlist
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {message}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-edge pb-px">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === "ACTIVE"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => handleFilterChange("ACTIVE")}
        >
          Active Playlists
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === "ARCHIVED"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => handleFilterChange("ARCHIVED")}
        >
          Archived Playlists
        </button>
      </div>

      {/* Playlists Table */}
      <div className="table-surface">
        {playlists.length === 0 ? (
          <div className="p-16 text-center text-muted">
            No {statusFilter === "ARCHIVED" ? "archived" : "active"} playlists found.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-ink">
            <thead className="border-b border-edge bg-surface-elevated text-secondary">
              <tr>
                <th className="px-6 py-4 font-semibold">Playlist</th>
                <th className="px-6 py-4 font-semibold">Slug</th>
                <th className="px-6 py-4 font-semibold">Releases</th>
                <th className="px-6 py-4 font-semibold">Platform</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {playlists.map((playlist) => (
                <tr className="transition hover:bg-surface-hover" key={playlist.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-edge bg-input">
                        {playlist.coverImageUrl ? (
                          <img
                            alt=""
                            className="object-cover h-full w-full"
                            src={playlist.coverImageUrl}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted">
                            <Music size={16} />
                          </div>
                        )}
                      </div>
                      <div>
                        <Link
                          className="font-semibold text-ink hover:underline"
                          href={`/admin/promo/playlists/${playlist.id}`}
                        >
                          {playlist.name}
                        </Link>
                        {playlist.featuredRelease_title && (
                          <p className="text-xs text-brand-primary">
                            Pinned: {playlist.featuredRelease_title}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {playlist.slug}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {playlist.activeReleaseCount ?? 0}
                  </td>
                  <td className="px-6 py-4">
                    <span className="status-badge-neutral capitalize">
                      {playlist.primaryPlatform}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {playlist.isArchived ? (
                      <span className="status-badge-danger">
                        Archived
                      </span>
                    ) : playlist.isPublic ? (
                      <span className="status-badge-ready">
                        Public
                      </span>
                    ) : (
                      <span className="status-badge-warning">
                        Private
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Copy link */}
                      <button
                        className="p-2 text-muted hover:text-ink rounded-lg transition"
                        onClick={() => handleCopyLink(playlist)}
                        title="Copy Clean URL"
                      >
                        {copiedId === playlist.id ? (
                          <Check className="text-emerald-400" size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>

                      {/* Public Toggle (only for active) */}
                      {!playlist.isArchived && (
                        <button
                          className="p-2 text-muted hover:text-ink rounded-lg transition"
                          onClick={() => handleTogglePublic(playlist)}
                          title={playlist.isPublic ? "Make Private" : "Make Public"}
                        >
                          {playlist.isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}

                      {/* Edit */}
                      <Link
                        className="p-2 text-muted hover:text-ink rounded-lg transition"
                        href={`/admin/promo/playlists/${playlist.id}`}
                        title="Edit Playlist"
                      >
                        <Edit2 size={16} />
                      </Link>

                      {/* Archive / Restore */}
                      {playlist.isArchived ? (
                        <button
                          className="p-2 text-muted hover:text-ink rounded-lg transition"
                          onClick={() => handleRestore(playlist)}
                          title="Restore Playlist"
                        >
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button
                          className="p-2 text-muted hover:text-rose-400 rounded-lg transition"
                          onClick={() => handleArchive(playlist.id)}
                          title="Archive Playlist"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-edge bg-surface p-6 shadow-[var(--shadow-modal)]">
            <h3 className="text-xl font-bold text-ink">Create Playlist</h3>
            <p className="mt-1.5 text-xs text-muted">
              Add a new marketing playlist. Slugs are auto-generated but editable.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="field-label">Playlist Name</label>
                <input
                  className="field-input mt-1.5 w-full"
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Nerd 2 Core"
                  value={name}
                />
              </div>

              <div>
                <label className="field-label">Slug</label>
                <input
                  className="field-input mt-1.5 w-full font-mono text-sm"
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="e.g. nerd-2-core"
                  value={slug}
                />
              </div>

              <div>
                <label className="field-label">Description (Optional)</label>
                <textarea
                  className="field-input mt-1.5 w-full h-20"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short summary for landing pages..."
                  value={description}
                />
              </div>

              <div>
                <label className="field-label">Cover Image URL (Optional)</label>
                <input
                  className="field-input mt-1.5 w-full"
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://..."
                  value={coverImageUrl}
                />
              </div>

              <div>
                <label className="field-label">Primary Platform</label>
                <select
                  className="field-input mt-1.5 w-full"
                  onChange={(e) => setPrimaryPlatform(e.target.value)}
                  value={primaryPlatform}
                >
                  <option value="spotify">Spotify</option>
                  <option value="apple">Apple Music</option>
                  <option value="youtube">YouTube Music</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  checked={isPublic}
                  className="rounded border-edge bg-transparent text-brand-primary focus:ring-brand-primary"
                  id="modalIsPublic"
                  onChange={(e) => setIsPublic(e.target.checked)}
                  type="checkbox"
                />
                <label className="text-sm text-ink cursor-pointer" htmlFor="modalIsPublic">
                  Make Public Immediately
                </label>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                className="action-button-muted py-2 text-sm"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="action-button-primary py-2 text-sm"
                disabled={isPending}
                onClick={handleCreate}
              >
                {isPending ? "Creating..." : "Create Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
