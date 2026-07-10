"use client";

import {useState, useTransition, useMemo} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {
  Music,
  ArrowLeft,
  Settings,
  Link2,
  Users,
  Copy,
  Check,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Trash2,
  Star,
  Plus
} from "lucide-react";
import {parseSpotifyResourceUrl} from "@/lib/spotify-links";
import {SpotifyMembershipControls} from "@/components/spotify-membership-controls";
import type {PlaylistRecord, PlaylistReleaseRecord, ReleaseSummary} from "@/lib/types";

export function PlaylistEditor({
  playlist: initialPlaylist,
  memberships: initialMemberships,
  releaseOptions,
  baseUrl
}: {
  playlist: PlaylistRecord;
  memberships: PlaylistReleaseRecord[];
  releaseOptions: ReleaseSummary[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"general" | "platforms" | "memberships" | "campaigns">("general");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  // General state
  const [name, setName] = useState(initialPlaylist.name);
  const [slug, setSlug] = useState(initialPlaylist.slug);
  const [description, setDescription] = useState(initialPlaylist.description);
  const [coverImageUrl, setCoverImageUrl] = useState(initialPlaylist.coverImageUrl);
  const [primaryPlatform, setPrimaryPlatform] = useState(initialPlaylist.primaryPlatform);
  const [isPublic, setIsPublic] = useState(playlistPublicState());
  const [isArchived, setIsArchived] = useState(initialPlaylist.isArchived);
  const [sortOrder, setSortOrder] = useState(initialPlaylist.sortOrder);
  const [featuredReleaseId, setFeaturedReleaseId] = useState(initialPlaylist.featuredReleaseId);

  // Platform URLs state
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState(initialPlaylist.spotifyPlaylistUrl);
  const [applePlaylistUrl, setApplePlaylistUrl] = useState(initialPlaylist.applePlaylistUrl);
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState(initialPlaylist.youtubePlaylistUrl);

  // Memberships state
  const [memberships, setMemberships] = useState(initialMemberships);
  const [selectedReleaseId, setSelectedReleaseId] = useState("");

  function playlistPublicState() {
    return initialPlaylist.isPublic;
  }

  // Copy Clean URL / UTM Template Helpers
  const handleCopyText = async (text: string, key: string) => {
    await navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const handleSaveGeneral = () => {
    setMessage("");
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Playlist name cannot be empty.");
      return;
    }
    if (!slug.trim()) {
      setErrorMsg("Playlist slug cannot be empty.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/playlists/${initialPlaylist.id}`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            name,
            slug,
            description,
            coverImageUrl,
            primaryPlatform,
            isPublic,
            isArchived,
            sortOrder,
            featuredReleaseId,
            spotifyPlaylistUrl,
            applePlaylistUrl,
            youtubePlaylistUrl
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to save details.");
        }

        setMessage("Playlist details saved successfully!");
        router.refresh();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to save details.");
      }
    });
  };

  // Add release to playlist membership list
  const handleAddRelease = () => {
    setErrorMsg("");
    if (!selectedReleaseId) return;

    // Check duplicate
    if (memberships.some((m) => m.releaseId === selectedReleaseId)) {
      setErrorMsg("This release is already a member of the playlist.");
      return;
    }

    const rel = releaseOptions.find((r) => r.id === selectedReleaseId);
    if (!rel) return;

    let defaultSpotifyMode = "manual";
    if (spotifyPlaylistUrl) {
      try {
        parseSpotifyResourceUrl(spotifyPlaylistUrl, "playlist");
        defaultSpotifyMode = "generated";
      } catch {}
    }

    const newMember: PlaylistReleaseRecord = {
      playlistId: initialPlaylist.id,
      releaseId: selectedReleaseId,
      position: memberships.length,
      spotifyTargetUrl: "",
      spotifyTrackUrl: "",
      spotifyTargetMode: defaultSpotifyMode,
      appleTargetUrl: "",
      youtubeTargetUrl: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      release_title: rel.title,
      release_slug: rel.slug
    };

    setMemberships([...memberships, newMember]);
    setSelectedReleaseId("");
  };

  // Remove release membership
  const handleRemoveRelease = (releaseId: string) => {
    setErrorMsg("");
    const filtered = memberships.filter((m) => m.releaseId !== releaseId);
    // Normalize positions
    const normalized = filtered.map((m, idx) => ({...m, position: idx}));
    setMemberships(normalized);

    // If removed release was featured, clear it
    if (featuredReleaseId === releaseId) {
      setFeaturedReleaseId(null);
    }
  };

  const handleUpdateSpotifyField = (
    releaseId: string,
    updates: {
      spotifyTrackUrl?: string;
      spotifyTargetMode?: string;
      spotifyTargetUrl?: string;
    }
  ) => {
    setMemberships((current) =>
      current.map((m) => (m.releaseId === releaseId ? {...m, ...updates} : m))
    );
  };

  // Update target URL for a membership row
  const handleUpdateTargetUrl = (
    releaseId: string,
    field: "appleTargetUrl" | "youtubeTargetUrl",
    value: string
  ) => {
    setMemberships((current) =>
      current.map((m) => (m.releaseId === releaseId ? {...m, [field]: value} : m))
    );
  };

  // Toggle active status for membership row
  const handleToggleActive = (releaseId: string) => {
    setMemberships((current) =>
      current.map((m) => {
        if (m.releaseId === releaseId) {
          const nextActive = !m.isActive;
          // If deactivating the featured release, clear it
          if (!nextActive && featuredReleaseId === releaseId) {
            setFeaturedReleaseId(null);
          }
          return {...m, isActive: nextActive};
        }
        return m;
      })
    );
  };

  // Move membership Up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...memberships];
    const temp = copy[index];
    copy[index] = copy[index - 1];
    copy[index - 1] = temp;

    // Normalize positions
    const normalized = copy.map((m, idx) => ({...m, position: idx}));
    setMemberships(normalized);
  };

  // Move membership Down
  const handleMoveDown = (index: number) => {
    if (index === memberships.length - 1) return;
    const copy = [...memberships];
    const temp = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = temp;

    // Normalize positions
    const normalized = copy.map((m, idx) => ({...m, position: idx}));
    setMemberships(normalized);
  };

  // Save memberships
  const handleSaveMemberships = () => {
    setMessage("");
    setErrorMsg("");

    startTransition(async () => {
      try {
        // Sync memberships API
        const response = await fetch(`/api/playlists/${initialPlaylist.id}/memberships`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            memberships: memberships.map((m) => ({
              releaseId: m.releaseId,
              position: m.position,
              spotifyTargetUrl: m.spotifyTargetUrl || "",
              spotifyTrackUrl: m.spotifyTrackUrl || "",
              spotifyTargetMode: m.spotifyTargetMode || "manual",
              appleTargetUrl: m.appleTargetUrl || "",
              youtubeTargetUrl: m.youtubeTargetUrl || "",
              isActive: m.isActive
            }))
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to sync memberships.");
        }

        if (data.memberships) {
          setMemberships(data.memberships);
        }

        // Save general details (including featuredReleaseId in case it was cleared)
        const responseGen = await fetch(`/api/playlists/${initialPlaylist.id}`, {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            name,
            slug,
            description,
            coverImageUrl,
            primaryPlatform,
            isPublic,
            isArchived,
            sortOrder,
            featuredReleaseId,
            spotifyPlaylistUrl,
            applePlaylistUrl,
            youtubePlaylistUrl
          })
        });

        if (!responseGen.ok) {
          const genErr = await responseGen.json();
          throw new Error(genErr.message || "Failed to update featured release reference.");
        }

        setMessage("Memberships synced successfully!");
        router.refresh();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to sync memberships.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary transition hover:text-brand-primary-hover"
          href="/admin/promo/playlists"
        >
          <ArrowLeft size={16} />
          Back to Playlists
        </Link>
        <div className="flex items-center gap-2">
          <Link
            className="action-button-muted inline-flex items-center gap-1 text-xs"
            href={`/listen/${initialPlaylist.slug}`}
            target="_blank"
          >
            Preview General
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* Title block */}
      <section className="panel px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">{initialPlaylist.name}</h1>
            <p className="text-xs text-muted mt-1">Playlist Editor &rarr; {initialPlaylist.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`uppercase tracking-[0.08em] ${
                initialPlaylist.isArchived
                  ? "status-badge-danger"
                  : initialPlaylist.isPublic
                  ? "status-badge-ready"
                  : "status-badge-warning"
              }`}
            >
              {initialPlaylist.isArchived ? "Archived" : initialPlaylist.isPublic ? "Public" : "Private"}
            </span>
          </div>
        </div>
      </section>

      {message && (
        <div className="state-panel-success">
          {message}
        </div>
      )}

      {errorMsg && (
        <div className="state-panel-danger">
          {errorMsg}
        </div>
      )}

      {/* Editor Tabs Navigation */}
      <div className="mobile-scroll-x flex items-center gap-1 border-b border-edge pb-px">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "general"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => setActiveTab("general")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Settings size={14} />
            General
          </span>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "platforms"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => setActiveTab("platforms")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Link2 size={14} />
            Platform Links
          </span>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "memberships"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => setActiveTab("memberships")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} />
            Members ({memberships.length})
          </span>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "campaigns"
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
          onClick={() => setActiveTab("campaigns")}
        >
          <span className="inline-flex items-center gap-1.5">
            <ExternalLink size={14} />
            Campaign Links
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "general" && (
        <section className="panel space-y-6 px-6 py-6">
          <h3 className="text-lg font-bold text-ink">General Playlist Details</h3>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="field-label">Playlist Name</label>
              <input
                className="field-input mt-1.5 w-full"
                onChange={(e) => setName(e.target.value)}
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

            <div className="md:col-span-2">
              <label className="field-label">Short Description</label>
              <textarea
                className="field-input mt-1.5 w-full h-24"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary displayed on landing pages..."
                value={description}
              />
            </div>

            <div>
              <label className="field-label">Cover Image URL</label>
              <input
                className="field-input mt-1.5 w-full font-mono text-sm"
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

            <div>
              <label className="field-label">Admin Sort Order</label>
              <input
                className="field-input mt-1.5 w-full"
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                type="number"
                value={sortOrder}
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  checked={isPublic}
                  className="sr-only peer"
                  onChange={(e) => setIsPublic(e.target.checked)}
                  type="checkbox"
                />
                <div className="toggle-control peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/30"></div>
                <span className="ml-2 text-sm text-ink">Public Visibility</span>
              </label>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  checked={isArchived}
                  className="sr-only peer"
                  onChange={(e) => setIsArchived(e.target.checked)}
                  type="checkbox"
                />
                <div className="toggle-control peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/30"></div>
                <span className="ml-2 text-sm text-ink">Archived Status</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end border-t border-edge pt-4">
            <button
              className="action-button-primary"
              disabled={isPending}
              onClick={handleSaveGeneral}
            >
              {isPending ? "Saving..." : "Save Playlist Details"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "platforms" && (
        <section className="panel space-y-6 px-6 py-6">
          <div>
            <h3 className="text-lg font-bold text-ink font-semibold">Playlist Platform Settings</h3>
            <p className="text-xs text-muted mt-1">
              Configure the playlist URL used for Spotify context links and set platform defaults. Public playlist pages now focus on individual release links instead of a playlist follow CTA.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="field-label">Spotify Playlist URL</label>
              <input
                className="field-input mt-1.5 w-full font-mono text-sm"
                onChange={(e) => setSpotifyPlaylistUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                value={spotifyPlaylistUrl}
              />
              {(() => {
                if (spotifyPlaylistUrl) {
                  if (!spotifyPlaylistUrl.startsWith("https://")) {
                    return (
                      <span className="text-xs text-rose-400 mt-1 block">
                        Invalid Spotify playlist URL (must start with https://)
                      </span>
                    );
                  }
                  try {
                    const parsed = parseSpotifyResourceUrl(spotifyPlaylistUrl, "playlist");
                    return (
                      <div className="mt-1 flex flex-col gap-1">
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          ✓ Valid Spotify playlist
                        </span>
                        <span className="text-[10px] text-muted font-mono bg-black/20 px-2 py-0.5 rounded border border-white/5 w-fit">
                          Playlist ID: {parsed.id}
                        </span>
                      </div>
                    );
                  } catch (err: any) {
                    return (
                      <span className="text-xs text-rose-400 mt-1 block">
                        Invalid Spotify playlist URL: {err.message}
                      </span>
                    );
                  }
                }
                return (
                  <span className="text-xs text-amber-400 mt-1 block">
                    Playlist URL required for generated Spotify targets
                  </span>
                );
              })()}
            </div>

            <div>
              <label className="field-label">Apple Music Playlist URL</label>
              <input
                className="field-input mt-1.5 w-full font-mono text-sm"
                onChange={(e) => setApplePlaylistUrl(e.target.value)}
                placeholder="https://music.apple.com/us/playlist/..."
                value={applePlaylistUrl}
              />
            </div>

            <div>
              <label className="field-label">YouTube Playlist URL</label>
              <input
                className="field-input mt-1.5 w-full font-mono text-sm"
                onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
                placeholder="https://youtube.com/playlist?list=..."
                value={youtubePlaylistUrl}
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-edge pt-4">
            <button
              className="action-button-primary"
              disabled={isPending}
              onClick={handleSaveGeneral}
            >
              {isPending ? "Saving..." : "Save Platform Links"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "memberships" && (
        <section className="panel space-y-6 px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-ink">Playlist Releases</h3>
              <p className="text-xs text-muted mt-1">
                Add, remove, or order releases. Configure the campaign target URL for each release.
              </p>
            </div>
            {/* Add release form */}
            <div className="flex items-center gap-2">
              <select
                className="field-input bg-input px-3 py-1.5 text-sm"
                onChange={(e) => setSelectedReleaseId(e.target.value)}
                value={selectedReleaseId}
              >
                <option value="">Select Release...</option>
                {releaseOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.type})
                  </option>
                ))}
              </select>
              <button
                className="action-button-primary py-1.5 text-sm inline-flex items-center gap-1"
                onClick={handleAddRelease}
              >
                <Plus size={14} />
                Add Release
              </button>
            </div>
          </div>

          {/* Members list */}
          <div className="space-y-4">
            {memberships.length === 0 ? (
              <div className="rounded-lg border border-dashed border-edge p-12 text-center text-muted">
                No members assigned to this playlist yet. Select a release above to add one.
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map((m, index) => {
                  const isFeatured = featuredReleaseId === m.releaseId;

                  return (
                    <div
                      className="command-surface space-y-4 p-5 transition hover:border-[rgba(246,201,69,0.3)]"
                      key={m.releaseId}
                    >
                      {/* Member header row */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="rounded-md bg-surface-elevated px-2 py-1 font-mono text-xs text-muted">
                            #{m.position + 1}
                          </span>
                          <span className="font-semibold text-ink">{m.release_title}</span>
                          {!m.isActive && (
                            <span className="status-badge-warning px-2 py-0.5 text-[10px]">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Order / Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-md border border-edge p-1.5 text-muted transition hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            className="rounded-md border border-edge p-1.5 text-muted transition hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                            disabled={index === memberships.length - 1}
                            onClick={() => handleMoveDown(index)}
                          >
                            <ChevronDown size={14} />
                          </button>

                          {/* Pin / Featured Toggle */}
                          <button
                            className={`p-1.5 rounded-lg border transition ${
                              isFeatured
                                ? "border-brand-primary bg-[var(--brand-primary-soft)] text-brand-primary"
                                : "border-edge text-muted hover:bg-surface-hover hover:text-ink"
                            }`}
                            disabled={!m.isActive}
                            onClick={() =>
                              setFeaturedReleaseId(isFeatured ? null : m.releaseId)
                            }
                            title={isFeatured ? "Pinned Hero" : "Pin as Hero Release"}
                          >
                            <Star size={14} fill={isFeatured ? "#c9a347" : "none"} />
                          </button>

                          <button
                            className="rounded-md border border-edge p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => handleRemoveRelease(m.releaseId)}
                            title="Remove Member"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Spotify Membership Controls */}
                      <div className="pt-2">
                        <SpotifyMembershipControls
                          trackUrl={m.spotifyTrackUrl || ""}
                          targetMode={m.spotifyTargetMode || "manual"}
                          targetUrl={m.spotifyTargetUrl || ""}
                          playlistUrl={spotifyPlaylistUrl}
                          isRegenerating={isPending}
                          onChange={(updates) => handleUpdateSpotifyField(m.releaseId, updates)}
                          onRegenerate={handleSaveMemberships}
                        />
                      </div>

                      {/* Apple & YouTube target URLs */}
                      <div className="grid gap-4 md:grid-cols-2 pt-2">
                        <div>
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                            Apple Music Track URL
                          </label>
                          <input
                            className="field-input py-1 px-2 text-xs w-full mt-1.5 font-mono"
                            onChange={(e) =>
                              handleUpdateTargetUrl(m.releaseId, "appleTargetUrl", e.target.value)
                            }
                            placeholder="https://music.apple.com/us/album/..."
                            value={m.appleTargetUrl}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                            YouTube Track URL
                          </label>
                          <input
                            className="field-input py-1 px-2 text-xs w-full mt-1.5 font-mono"
                            onChange={(e) =>
                              handleUpdateTargetUrl(m.releaseId, "youtubeTargetUrl", e.target.value)
                            }
                            placeholder="https://youtube.com/watch?v=..."
                            value={m.youtubeTargetUrl}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            checked={m.isActive}
                            className="sr-only peer"
                            onChange={() => handleToggleActive(m.releaseId)}
                            type="checkbox"
                          />
                          <div className="toggle-control h-4 w-8 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-primary/30 after:h-3 after:w-3"></div>
                          <span className="ml-2 text-xs text-muted">Active Membership</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-edge pt-4">
            <button
              className="action-button-primary"
              disabled={isPending}
              onClick={handleSaveMemberships}
            >
              {isPending ? "Saving..." : "Save Memberships"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "campaigns" && (
        <section className="panel space-y-6 px-6 py-6">
          <div>
            <h3 className="text-lg font-bold text-ink">Campaign Link Builder</h3>
            <p className="text-xs text-muted mt-1">
              Prefill campaign links to deploy on Meta Ads, matching the exact target track URLs.
            </p>
          </div>

          <div className="space-y-4">
            {memberships.filter((m) => m.isActive).length === 0 ? (
              <div className="p-12 text-center text-muted">
                No active membership rows available. Make sure members are active and saved.
              </div>
            ) : (
              memberships
                .filter((m) => m.isActive)
                .map((m) => {
                  const relativeCleanPath = `/listen/${initialPlaylist.slug}/${m.release_slug}`;
                  const fullCleanUrl = `${baseUrl.replace(/\/+$/g, "")}${relativeCleanPath}`;
                  const metaTemplateUrl = `${fullCleanUrl}?utm_source=meta&utm_medium=paid_social&utm_campaign=${m.release_slug}&utm_content=[ad_name]`;

                  // Prefill params for the Short Link create screen
                  const shortLinkParams = new URLSearchParams({
                    destinationUrl: fullCleanUrl,
                    releaseId: m.releaseId,
                    campaignLabel: "playlist",
                    contentLabel: initialPlaylist.slug,
                    utmSource: "meta",
                    utmMedium: "paid_social",
                    utmCampaign: m.release_slug ?? ""
                  });
                  const shortLinkCreateHref = `/admin/short-links?${shortLinkParams.toString()}`;

                  return (
                    <div
                      className="command-surface space-y-4 p-5"
                      key={m.releaseId}
                    >
                      <h4 className="font-semibold text-ink text-base">{m.release_title}</h4>

                      {/* Clean Landing Link row */}
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                        <div className="inset-surface truncate select-all px-3.5 py-2 font-mono text-xs text-muted">
                          {fullCleanUrl}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="action-button-muted py-1.5 px-3 text-xs inline-flex items-center gap-1"
                            onClick={() => handleCopyText(fullCleanUrl, `${m.releaseId}-clean`)}
                          >
                            {copiedKey === `${m.releaseId}-clean` ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                Copy URL
                              </>
                            )}
                          </button>
                          <Link
                            className="action-button-muted py-1.5 px-3 text-xs inline-flex items-center gap-1"
                            href={relativeCleanPath}
                            target="_blank"
                          >
                            <ExternalLink size={12} />
                            Preview
                          </Link>
                        </div>
                      </div>

                      {/* Meta Template row */}
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center pt-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted block mb-1.5">
                            Meta Ads URL Template
                          </label>
                          <div className="inset-surface truncate select-all px-3.5 py-2 font-mono text-xs text-muted">
                            {metaTemplateUrl}
                          </div>
                        </div>
                        <div className="pt-5 flex items-center justify-end">
                          <button
                            className="action-button-muted py-1.5 px-3 text-xs inline-flex items-center gap-1"
                            onClick={() => handleCopyText(metaTemplateUrl, `${m.releaseId}-meta`)}
                          >
                            {copiedKey === `${m.releaseId}-meta` ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                Copy Template
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Spotify Direct Context Link / Target URL */}
                      {m.spotifyTargetUrl && (
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center pt-2">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted block mb-1.5">
                              {m.spotifyTargetMode === "generated" ? "Direct Spotify Context Link" : "Spotify Target (Manual)"}
                            </label>
                            <div className="inset-surface truncate select-all px-3.5 py-2 font-mono text-xs text-muted">
                              {m.spotifyTargetUrl}
                            </div>
                          </div>
                          <div className="pt-5 flex items-center justify-end gap-1.5">
                            <button
                              className="action-button-muted py-1.5 px-3 text-xs inline-flex items-center gap-1"
                              onClick={() => handleCopyText(m.spotifyTargetUrl, `${m.releaseId}-spotify-target`)}
                            >
                              {copiedKey === `${m.releaseId}-spotify-target` ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  {m.spotifyTargetMode === "generated" ? "Copy Direct Spotify Context Link" : "Copy Spotify Target"}
                                </>
                              )}
                            </button>
                            <a
                              className="action-button-muted py-1.5 px-3 text-xs inline-flex items-center gap-1"
                              href={m.spotifyTargetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={12} />
                              {m.spotifyTargetMode === "generated" ? "Test Spotify Context Link" : "Test Spotify Target"}
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Tracked short link integration */}
                      <div className="pt-2 flex justify-start">
                        <Link
                          className="action-button-muted inline-flex gap-1 px-4 py-1.5 text-xs hover:border-[rgba(246,201,69,0.4)] hover:text-brand-primary"
                          href={shortLinkCreateHref}
                        >
                          <Link2 size={12} />
                          Create Tracked Short Link
                        </Link>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
