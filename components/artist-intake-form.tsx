"use client";

import {
  CheckCircle2,
  Plus,
  Save,
  Send,
  Trash2,
  Upload
} from "lucide-react";
import {useState} from "react";

import {
  createEmptyArtistIntakeRelease,
  type ArtistIntakeBreakdown,
  type ArtistIntakeRelease,
  type ArtistIntakeResponse
} from "@/lib/artist-intake";
import {ARTIST_THEME_FAMILIES} from "@/lib/artist-profiles";
import type {CountryOption} from "@/lib/countries";

type RequestState = "idle" | "saving" | "submitting" | "success" | "error";

function commaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function FieldLabel({
  children,
  required = false
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/65">
      {children}
      {required ? <span className="ml-1 text-[#d7b663]">*</span> : null}
    </span>
  );
}

export function ArtistIntakeForm({
  countryOptions,
  initialResponse,
  token
}: {
  countryOptions: CountryOption[];
  initialResponse: ArtistIntakeResponse;
  token: string;
}) {
  const [draft, setDraft] = useState(initialResponse);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [uploadingKey, setUploadingKey] = useState("");

  function updateArtist<K extends keyof ArtistIntakeResponse["artist"]>(
    key: K,
    value: ArtistIntakeResponse["artist"][K]
  ) {
    setDraft((current) => ({
      ...current,
      artist: {...current.artist, [key]: value}
    }));
  }

  function updateLink(platform: string, url: string) {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.platform === platform ? {...link, url} : link
      )
    }));
  }

  function updateRelease(id: string, patch: Partial<ArtistIntakeRelease>) {
    setDraft((current) => ({
      ...current,
      releases: current.releases.map((release) =>
        release.id === id ? {...release, ...patch} : release
      )
    }));
  }

  function chooseFeaturedRelease(id: string) {
    setDraft((current) => ({
      ...current,
      releases: current.releases.map((release) => ({
        ...release,
        isFeatured: release.id === id
      }))
    }));
  }

  function addRelease() {
    if (draft.releases.length >= 3) return;
    setDraft((current) => ({
      ...current,
      releases: [...current.releases, createEmptyArtistIntakeRelease(false)]
    }));
  }

  function removeRelease(id: string) {
    if (draft.releases.length === 1) return;
    setDraft((current) => {
      const remaining = current.releases.filter((release) => release.id !== id);
      if (!remaining.some((release) => release.isFeatured)) {
        remaining[0] = {...remaining[0], isFeatured: true};
      }
      return {...current, releases: remaining};
    });
  }

  function addBreakdown(releaseId: string) {
    const release = draft.releases.find((item) => item.id === releaseId);
    if (!release || release.breakdowns.length >= 5) return;
    updateRelease(releaseId, {
      breakdowns: [
        ...release.breakdowns,
        {
          id: crypto.randomUUID(),
          lyricExcerpt: "",
          explanation: "",
          referenceUrl: ""
        }
      ]
    });
  }

  function updateBreakdown(
    releaseId: string,
    breakdownId: string,
    patch: Partial<ArtistIntakeBreakdown>
  ) {
    const release = draft.releases.find((item) => item.id === releaseId);
    if (!release) return;
    updateRelease(releaseId, {
      breakdowns: release.breakdowns.map((breakdown) =>
        breakdown.id === breakdownId ? {...breakdown, ...patch} : breakdown
      )
    });
  }

  function removeBreakdown(releaseId: string, breakdownId: string) {
    const release = draft.releases.find((item) => item.id === releaseId);
    if (!release) return;
    updateRelease(releaseId, {
      breakdowns: release.breakdowns.filter(
        (breakdown) => breakdown.id !== breakdownId
      )
    });
  }

  async function uploadImage(
    file: File,
    key: string,
    onUploaded: (url: string) => void
  ) {
    setUploadingKey(key);
    setMessage("");
    setIssues([]);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(
        `/api/artist-intake/${encodeURIComponent(token)}/image`,
        {method: "POST", body: formData}
      );
      const payload = (await response.json()) as {url?: string; message?: string};
      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "The image could not be uploaded.");
      }
      onUploaded(payload.url);
      setMessage("Image uploaded. Save your draft to keep the new URL.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploadingKey("");
    }
  }

  async function persist(intent: "save" | "submit") {
    if (requestState === "saving" || requestState === "submitting") return;
    setRequestState(intent === "submit" ? "submitting" : "saving");
    setMessage("");
    setIssues([]);
    try {
      const response = await fetch(
        `/api/artist-intake/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            intent,
            response: draft,
            bot_test_field: ""
          })
        }
      );
      const payload = (await response.json()) as {
        message?: string;
        issues?: Array<{message: string}>;
        status?: string;
      };
      if (!response.ok) {
        setIssues(
          Array.from(
            new Set((payload.issues || []).map((issue) => issue.message))
          )
        );
        throw new Error(payload.message || "The intake could not be saved.");
      }
      if (intent === "submit") {
        setRequestState("success");
        setMessage(payload.message || "Your intake has been submitted.");
      } else {
        setRequestState("idle");
        setMessage(payload.message || "Draft saved.");
      }
    } catch (error) {
      setRequestState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (requestState === "success") {
    return (
      <section className="border border-emerald-400/25 bg-emerald-400/[0.06] px-6 py-14 text-center sm:px-12">
        <CheckCircle2 className="mx-auto text-emerald-300" size={44} />
        <h2 className="mt-6 text-3xl font-semibold text-white">Intake submitted</h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/65">
          {message} Your answers will be reviewed and shaped inside the managed
          artist CMS before a private profile preview is created.
        </p>
      </section>
    );
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        void persist("submit");
      }}
    >
      <input
        aria-hidden="true"
        className="hidden"
        name="bot_test_field"
        tabIndex={-1}
      />

      <section className="border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d7b663]">
          01 / Artist foundation
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Tell us what should anchor your profile.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
          Write naturally. These are source notes for editorial review, not copy
          that will be published automatically.
        </p>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <FieldLabel required>Artist name</FieldLabel>
            <input
              className="field-input bg-black/30 text-white"
              onChange={(event) => updateArtist("displayName", event.target.value)}
              value={draft.artist.displayName}
            />
          </label>
          <label className="space-y-2">
            <FieldLabel required>Contact email</FieldLabel>
            <input
              className="field-input bg-black/30 text-white"
              onChange={(event) => updateArtist("contactEmail", event.target.value)}
              type="email"
              value={draft.artist.contactEmail}
            />
          </label>
          <label className="space-y-2">
            <FieldLabel required>Public country</FieldLabel>
            <select
              className="field-input bg-black/30 text-white"
              onChange={(event) => updateArtist("countryCode", event.target.value)}
              value={draft.artist.countryCode}
            >
              <option value="">Choose a country</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <FieldLabel>Preferred visual theme</FieldLabel>
            <select
              className="field-input bg-black/30 text-white"
              onChange={(event) =>
                updateArtist(
                  "themeFamily",
                  event.target.value as ArtistIntakeResponse["artist"]["themeFamily"]
                )
              }
              value={draft.artist.themeFamily}
            >
              {ARTIST_THEME_FAMILIES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <FieldLabel required>How do you describe your sound?</FieldLabel>
            <textarea
              className="field-input min-h-32 bg-black/30 text-white"
              onChange={(event) =>
                updateArtist("soundDescription", event.target.value)
              }
              placeholder="Describe your range, influences, energy, writing approach, production style, or anything else that matters."
              value={draft.artist.soundDescription}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <FieldLabel required>What makes your work distinct?</FieldLabel>
            <textarea
              className="field-input min-h-28 bg-black/30 text-white"
              onChange={(event) =>
                updateArtist("differentiator", event.target.value)
              }
              placeholder="What should a new listener understand about your creative fingerprint?"
              value={draft.artist.differentiator}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <FieldLabel required>Primary genres</FieldLabel>
            <input
              className="field-input bg-black/30 text-white"
              onChange={(event) =>
                updateArtist("genres", commaList(event.target.value))
              }
              placeholder="Trap, drill, R&B"
              value={draft.artist.genres.join(", ")}
            />
          </label>
        </div>
      </section>

      <section className="border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d7b663]">
          02 / Profile image
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Add the image that should lead the profile.
        </h2>
        <div className="mt-7 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-2">
            <FieldLabel required>Image URL</FieldLabel>
            <input
              className="field-input bg-black/30 text-white"
              onChange={(event) =>
                updateArtist("profileImageUrl", event.target.value)
              }
              placeholder="https://..."
              type="url"
              value={draft.artist.profileImageUrl}
            />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-white/15 bg-white/[0.04] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-[#d7b663]/50 hover:text-[#d7b663]">
            <Upload size={15} />
            {uploadingKey === "profile" ? "Uploading..." : "Upload image"}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={Boolean(uploadingKey)}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadImage(file, "profile", (url) =>
                    updateArtist("profileImageUrl", url)
                  );
                }
              }}
              type="file"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <FieldLabel>Image description</FieldLabel>
            <input
              className="field-input bg-black/30 text-white"
              onChange={(event) =>
                updateArtist("profileImageAlt", event.target.value)
              }
              placeholder="A concise description for accessibility"
              value={draft.artist.profileImageAlt}
            />
          </label>
          <label className="flex items-start gap-3 md:col-span-2">
            <input
              checked={draft.artist.imageRightsConfirmed}
              className="mt-1"
              onChange={(event) =>
                updateArtist("imageRightsConfirmed", event.target.checked)
              }
              type="checkbox"
            />
            <span className="text-sm leading-6 text-white/65">
              I confirm that this image can be displayed publicly on my managed
              artist profile. <span className="text-[#d7b663]">*</span>
            </span>
          </label>
        </div>
      </section>

      <section className="border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d7b663]">
          03 / Artist links
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Where should listeners find you?
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/55">
          Add only the destinations you actively use. Blank links will be omitted.
        </p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {draft.links.map((link) => (
            <label className="space-y-2" key={link.platform}>
              <FieldLabel>{link.label}</FieldLabel>
              <input
                className="field-input bg-black/30 text-white"
                onChange={(event) => updateLink(link.platform, event.target.value)}
                placeholder="https://..."
                type="url"
                value={link.url}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d7b663]">
              04 / Selected releases
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Choose up to three releases.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
              Mark one as Start Here. Only that release asks for editorial depth;
              the others become streamlined “More from the artist” cards.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 border border-white/15 px-4 py-2.5 text-xs font-semibold text-white transition hover:border-[#d7b663]/50 hover:text-[#d7b663] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={draft.releases.length >= 3}
            onClick={addRelease}
            type="button"
          >
            <Plus size={15} />
            Add release
          </button>
        </div>

        <div className="mt-8 space-y-6">
          {draft.releases.map((release, index) => (
            <article
              className={`border p-5 sm:p-7 ${
                release.isFeatured
                  ? "border-[#d7b663]/45 bg-[#d7b663]/[0.04]"
                  : "border-white/10 bg-black/15"
              }`}
              key={release.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    checked={release.isFeatured}
                    name="featured-release"
                    onChange={() => chooseFeaturedRelease(release.id)}
                    type="radio"
                  />
                  <span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7b663]">
                      Release {index + 1}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-white">
                      {release.isFeatured
                        ? "Start Here / editorial"
                        : "More from the artist"}
                    </span>
                  </span>
                </label>
                {draft.releases.length > 1 ? (
                  <button
                    aria-label={`Remove release ${index + 1}`}
                    className="text-white/40 transition hover:text-red-300"
                    onClick={() => removeRelease(release.id)}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <FieldLabel required>Release title</FieldLabel>
                  <input
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {title: event.target.value})
                    }
                    value={release.title}
                  />
                </label>
                <label className="space-y-2">
                  <FieldLabel>Release type</FieldLabel>
                  <select
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {type: event.target.value})
                    }
                    value={release.type}
                  >
                    {["Single", "EP", "Album", "Mixtape", "Collaboration", "Other"].map(
                      (type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label className="space-y-2">
                  <FieldLabel>Release date</FieldLabel>
                  <input
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {releaseDate: event.target.value})
                    }
                    type="date"
                    value={release.releaseDate}
                  />
                </label>
                <label className="space-y-2">
                  <FieldLabel required>Spotify link</FieldLabel>
                  <input
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {spotifyUrl: event.target.value})
                    }
                    placeholder="Used to prefill title and artwork when available"
                    type="url"
                    value={release.spotifyUrl}
                  />
                </label>
                <label className="space-y-2">
                  <FieldLabel>Apple Music link</FieldLabel>
                  <input
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {
                        appleMusicUrl: event.target.value
                      })
                    }
                    type="url"
                    value={release.appleMusicUrl}
                  />
                </label>
                <label className="space-y-2">
                  <FieldLabel>YouTube link</FieldLabel>
                  <input
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {youtubeUrl: event.target.value})
                    }
                    type="url"
                    value={release.youtubeUrl}
                  />
                </label>
                <label className="space-y-2">
                  <FieldLabel required>Cover art URL</FieldLabel>
                  <input
                    className="field-input bg-black/30 text-white"
                    onChange={(event) =>
                      updateRelease(release.id, {coverArtUrl: event.target.value})
                    }
                    placeholder="Paste a URL or upload the artwork"
                    type="url"
                    value={release.coverArtUrl}
                  />
                </label>
                <div className="flex items-end">
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-white/15 bg-white/[0.04] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-[#d7b663]/50 hover:text-[#d7b663]">
                    <Upload size={15} />
                    {uploadingKey === `release-${release.id}`
                      ? "Uploading..."
                      : "Upload cover"}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={Boolean(uploadingKey)}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void uploadImage(
                            file,
                            `release-${release.id}`,
                            (url) => updateRelease(release.id, {coverArtUrl: url})
                          );
                        }
                      }}
                      type="file"
                    />
                  </label>
                </div>
                <label className="flex items-start gap-3 md:col-span-2">
                  <input
                    checked={release.coverArtRightsConfirmed}
                    className="mt-1"
                    onChange={(event) =>
                      updateRelease(release.id, {
                        coverArtRightsConfirmed: event.target.checked
                      })
                    }
                    type="checkbox"
                  />
                  <span className="text-sm leading-6 text-white/65">
                    I confirm this cover art can be displayed publicly on the
                    artist profile and release page.{" "}
                    <span className="text-[#d7b663]">*</span>
                  </span>
                </label>
              </div>

              {release.isFeatured ? (
                <div className="mt-8 border-t border-[#d7b663]/20 pt-7">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7b663]">
                      Editorial depth
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      These details shape the dedicated release page. There is no
                      promo-summary, stage-completion, or release-concept section.
                    </p>
                  </div>
                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <FieldLabel required>Track profile summary</FieldLabel>
                      <textarea
                        className="field-input min-h-32 bg-black/30 text-white"
                        onChange={(event) =>
                          updateRelease(release.id, {
                            trackSummary: event.target.value
                          })
                        }
                        placeholder="What should a new listener know about this specific track—its context, meaning, energy, or significance?"
                        value={release.trackSummary}
                      />
                    </label>
                    <label className="space-y-2">
                      <FieldLabel>Collaborators</FieldLabel>
                      <textarea
                        className="field-input min-h-24 bg-black/30 text-white"
                        onChange={(event) =>
                          updateRelease(release.id, {
                            collaborators: event.target.value
                          })
                        }
                        placeholder="Names and profile links, if available"
                        value={release.collaborators}
                      />
                    </label>
                    <label className="space-y-2">
                      <FieldLabel>Credits</FieldLabel>
                      <textarea
                        className="field-input min-h-24 bg-black/30 text-white"
                        onChange={(event) =>
                          updateRelease(release.id, {credits: event.target.value})
                        }
                        placeholder="Producer, writer, engineer, artwork, etc."
                        value={release.credits}
                      />
                    </label>
                    {[
                      ["languages", "Languages", "English, Arabic"],
                      ["genres", "Genres", "Trap, alternative hip-hop"],
                      ["moods", "Moods", "Reflective, triumphant"],
                      ["themes", "Themes", "Identity, perseverance"],
                      ["listenerContexts", "Best for", "Late-night listening, workouts"]
                    ].map(([key, label, placeholder]) => (
                      <label className="space-y-2" key={key}>
                        <FieldLabel>{label}</FieldLabel>
                        <input
                          className="field-input bg-black/30 text-white"
                          onChange={(event) =>
                            updateRelease(release.id, {
                              [key]: commaList(event.target.value)
                            })
                          }
                          placeholder={placeholder}
                          value={(
                            release[key as keyof ArtistIntakeRelease] as string[]
                          ).join(", ")}
                        />
                      </label>
                    ))}
                    <label className="space-y-2">
                      <FieldLabel>Featured video URL</FieldLabel>
                      <input
                        className="field-input bg-black/30 text-white"
                        onChange={(event) =>
                          updateRelease(release.id, {
                            featuredVideoUrl: event.target.value
                          })
                        }
                        type="url"
                        value={release.featuredVideoUrl}
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <FieldLabel>Lyrics</FieldLabel>
                      <textarea
                        className="field-input min-h-64 whitespace-pre-wrap bg-black/30 font-mono text-sm text-white"
                        onChange={(event) =>
                          updateRelease(release.id, {lyrics: event.target.value})
                        }
                        placeholder={"[Verse 1]\nPaste the lyrics exactly as they should appear..."}
                        value={release.lyrics}
                      />
                    </label>
                    <label className="flex items-start gap-3 md:col-span-2">
                      <input
                        checked={release.lyricsRightsConfirmed}
                        className="mt-1"
                        onChange={(event) =>
                          updateRelease(release.id, {
                            lyricsRightsConfirmed: event.target.checked
                          })
                        }
                        type="checkbox"
                      />
                      <span className="text-sm leading-6 text-white/65">
                        If I submitted lyrics, I confirm they can be displayed
                        publicly on this release page.
                      </span>
                    </label>
                  </div>

                  <div className="mt-8 border-t border-white/10 pt-7">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Lyrics & breakdown suggestions
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/50">
                          Optional: choose up to five lines or bars worth unpacking.
                        </p>
                      </div>
                      <button
                        className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:border-[#d7b663]/50 hover:text-[#d7b663] disabled:opacity-40"
                        disabled={release.breakdowns.length >= 5}
                        onClick={() => addBreakdown(release.id)}
                        type="button"
                      >
                        <Plus size={14} />
                        Add breakdown
                      </button>
                    </div>
                    <div className="mt-5 space-y-4">
                      {release.breakdowns.map((breakdown, breakdownIndex) => (
                        <div
                          className="border border-white/10 bg-black/20 p-4"
                          key={breakdown.id}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7b663]">
                              Breakdown {breakdownIndex + 1}
                            </p>
                            <button
                              aria-label={`Remove breakdown ${breakdownIndex + 1}`}
                              className="text-white/40 hover:text-red-300"
                              onClick={() =>
                                removeBreakdown(release.id, breakdown.id)
                              }
                              type="button"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="mt-4 grid gap-4">
                            <label className="space-y-2">
                              <FieldLabel>Lyric excerpt</FieldLabel>
                              <textarea
                                className="field-input min-h-20 bg-black/30 text-white"
                                onChange={(event) =>
                                  updateBreakdown(release.id, breakdown.id, {
                                    lyricExcerpt: event.target.value
                                  })
                                }
                                value={breakdown.lyricExcerpt}
                              />
                            </label>
                            <label className="space-y-2">
                              <FieldLabel>What should listeners understand?</FieldLabel>
                              <textarea
                                className="field-input min-h-24 bg-black/30 text-white"
                                onChange={(event) =>
                                  updateBreakdown(release.id, breakdown.id, {
                                    explanation: event.target.value
                                  })
                                }
                                value={breakdown.explanation}
                              />
                            </label>
                            <label className="space-y-2">
                              <FieldLabel>Reference link</FieldLabel>
                              <input
                                className="field-input bg-black/30 text-white"
                                onChange={(event) =>
                                  updateBreakdown(release.id, breakdown.id, {
                                    referenceUrl: event.target.value
                                  })
                                }
                                placeholder="Optional source, definition, or context link"
                                type="url"
                                value={breakdown.referenceUrl}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d7b663]">
          05 / Final notes
        </p>
        <label className="mt-6 block space-y-2">
          <FieldLabel>Anything else we should know?</FieldLabel>
          <textarea
            className="field-input min-h-28 bg-black/30 text-white"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                additionalNotes: event.target.value
              }))
            }
            placeholder="Priorities, sensitivities, naming preferences, or context that did not fit above."
            value={draft.additionalNotes}
          />
        </label>
        <label className="mt-6 flex items-start gap-3">
          <input
            checked={draft.submissionConfirmed}
            className="mt-1"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                submissionConfirmed: event.target.checked
              }))
            }
            type="checkbox"
          />
          <span className="text-sm leading-6 text-white/65">
            I have reviewed these answers and understand they will be edited and
            arranged before anything is published. <span className="text-[#d7b663]">*</span>
          </span>
        </label>
      </section>

      {message ? (
        <div
          className={
            requestState === "error"
              ? "border border-red-400/30 bg-red-400/[0.06] px-5 py-4 text-sm text-red-100"
              : "border border-[#d7b663]/25 bg-[#d7b663]/[0.05] px-5 py-4 text-sm text-white/75"
          }
        >
          <p>{message}</p>
          {issues.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/35 disabled:opacity-50"
          disabled={
            requestState === "saving" ||
            requestState === "submitting" ||
            Boolean(uploadingKey)
          }
          onClick={() => void persist("save")}
          type="button"
        >
          <Save size={16} />
          {requestState === "saving" ? "Saving..." : "Save draft"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d7b663] px-7 py-3 text-sm font-semibold text-black transition hover:bg-[#ead082] disabled:opacity-50"
          disabled={
            requestState === "saving" ||
            requestState === "submitting" ||
            Boolean(uploadingKey)
          }
          type="submit"
        >
          <Send size={16} />
          {requestState === "submitting" ? "Submitting..." : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
