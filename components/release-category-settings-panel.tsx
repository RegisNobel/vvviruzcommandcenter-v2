"use client";

import Image from "next/image";
import {Layers3, Plus, Save, Trash2, UploadCloud} from "lucide-react";
import {useMemo, useState} from "react";

import type {
  ReleaseCategoryRecord,
  ReleaseCoverUploadResponse,
  ReleaseSummary
} from "@/lib/types";
import {createId} from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

type ReleaseCategorySettingsPanelProps = {
  approvedProjectSlugs?: string[];
  initialCategories: ReleaseCategoryRecord[];
  releaseOptions: ReleaseSummary[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createDraftCategory(index: number): ReleaseCategoryRecord {
  const now = new Date().toISOString();

  return {
    id: createId(),
    name: "",
    slug: "",
    description: "",
    project_type: "series",
    artwork_path: "",
    artwork_alt_text: "",
    project_release_date: "",
    spotify_url: "",
    apple_music_url: "",
    youtube_url: "",
    sort_order: index,
    release_ids: [],
    created_at: now,
    updated_at: now
  };
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as
    | (T & {message?: string})
    | {message?: string}
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed.");
  }

  return payload as T & {message?: string};
}

export function ReleaseCategorySettingsPanel({
  approvedProjectSlugs = [],
  initialCategories,
  releaseOptions
}: ReleaseCategorySettingsPanelProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadingArtworkId, setUploadingArtworkId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const releaseOptionsById = useMemo(
    () => new Map(releaseOptions.map((release) => [release.id, release])),
    [releaseOptions]
  );

  function updateCategory(
    categoryId: string,
    patch: Partial<ReleaseCategoryRecord>,
    options?: {syncSlug?: boolean}
  ) {
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        const next = {...category, ...patch};

        if (options?.syncSlug && patch.name !== undefined && !category.slug.trim()) {
          next.slug = slugify(patch.name);
        }

        return next;
      })
    );
  }

  function toggleCategoryRelease(categoryId: string, releaseId: string) {
    setCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        const releaseIds = category.release_ids.includes(releaseId)
          ? category.release_ids.filter((currentReleaseId) => currentReleaseId !== releaseId)
          : [...category.release_ids, releaseId];

        return {
          ...category,
          release_ids: releaseIds
        };
      })
    );
  }

  function addCategory() {
    setCategories((current) => [...current, createDraftCategory(current.length)]);
    setMessage(null);
    setSaveState("idle");
  }

  async function uploadProjectArtwork(category: ReleaseCategoryRecord, file: File) {
    setUploadingArtworkId(category.id);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("previousPath", category.artwork_path);
      const response = await fetch("/api/releases/cover-upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as
        | (ReleaseCoverUploadResponse & {message?: string})
        | null;

      if (!response.ok || !payload?.asset?.url) {
        throw new Error(payload?.message || "Unable to upload project artwork.");
      }

      updateCategory(category.id, {artwork_path: payload.asset.url});
      setMessage("Project artwork uploaded. Save Projects to keep the change.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload project artwork.");
    } finally {
      setUploadingArtworkId(null);
    }
  }

  function deleteCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    const shouldDelete = window.confirm(
      `Delete ${category?.name || "this category"}? This only removes the music-page category, not the releases.`
    );

    if (!shouldDelete) {
      return;
    }

    setCategories((current) =>
      current
        .filter((item) => item.id !== categoryId)
        .map((item, index) => ({...item, sort_order: index}))
    );
  }

  async function saveCategories() {
    setSaveState("saving");
    setMessage(null);

    try {
      const payload = await readJson<{
        categories: ReleaseCategoryRecord[];
        message: string;
      }>("/api/release-categories", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          categories: categories.map((category, index) => ({
            ...category,
            sort_order: index,
            slug: category.slug.trim() || slugify(category.name)
          }))
        })
      });

      setCategories(payload.categories);
      setSaveState("saved");
      setMessage(payload.message ?? "Music categories saved.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Unable to save categories.");
    }
  }

  return (
    <section className="panel scroll-mt-36 space-y-6 px-6 py-7" id="music-categories">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="pill">
            <Layers3 size={12} />
            Projects + Categories
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Project and category content
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Manage the single project record that organizes releases, artwork, public
            context, format, and ordered tracklists. Project approval and homepage
            ordering remain in the Public Projects section above.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="pill">
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save error"
                  : "Manual save"}
          </span>
          <button className="action-button-secondary" onClick={addCategory} type="button">
            <Plus size={16} />
            Add Project
          </button>
          <button className="action-button-primary" onClick={() => void saveCategories()} type="button">
            <Save size={16} />
            Save Projects
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {categories.map((category, index) => (
          <section
            className="command-surface p-4 sm:p-5"
            key={category.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="field-label">Category {index + 1}</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">
                  {category.name || "Untitled category"}
                </h3>
              </div>
              <button
                className="action-button-danger"
                onClick={() => deleteCategory(category.id)}
                type="button"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Project Name</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(
                      category.id,
                      {name: event.target.value},
                      {syncSlug: true}
                    )
                  }
                  placeholder="Multiversus"
                  value={category.name}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Project Kind</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {
                      project_type: event.target.value as ReleaseCategoryRecord["project_type"]
                    })
                  }
                  value={category.project_type}
                >
                  <option value="series">Series / collection</option>
                  <option value="album">Album</option>
                  <option value="ep">EP</option>
                  <option value="mixtape">Mixtape</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="field-label">Project Release Date</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {project_release_date: event.target.value})
                  }
                  type="date"
                  value={category.project_release_date}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">URL Slug</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {slug: slugify(event.target.value)})
                  }
                  placeholder="multiversus"
                  value={category.slug}
                />
              </label>

              <div className="space-y-3 md:col-span-2">
                <span className="field-label">Project Artwork</span>
                <div className="grid gap-4 rounded-xl border border-edge bg-surface p-4 sm:grid-cols-[120px_1fr] sm:items-center">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-edge bg-input">
                    {category.artwork_path ? (
                      <Image
                        alt={category.artwork_alt_text || `${category.name || "Project"} artwork`}
                        className="object-cover"
                        fill
                        sizes="120px"
                        src={category.artwork_path}
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <label className="action-button-secondary cursor-pointer">
                      <UploadCloud size={16} />
                      {uploadingArtworkId === category.id ? "Uploading..." : "Upload Artwork"}
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadingArtworkId === category.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadProjectArtwork(category, file);
                          event.currentTarget.value = "";
                        }}
                        type="file"
                      />
                    </label>
                    <input
                      className="field-input"
                      onChange={(event) =>
                        updateCategory(category.id, {artwork_path: event.target.value})
                      }
                      placeholder="Or paste an artwork URL"
                      value={category.artwork_path}
                    />
                  </div>
                </div>
              </div>

              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Artwork Alt Text</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {artwork_alt_text: event.target.value})
                  }
                  placeholder={`${category.name || "Project"} artwork`}
                  value={category.artwork_alt_text}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Spotify URL</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {spotify_url: event.target.value})
                  }
                  value={category.spotify_url}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Apple Music URL</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {apple_music_url: event.target.value})
                  }
                  value={category.apple_music_url}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="field-label">YouTube URL</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCategory(category.id, {youtube_url: event.target.value})
                  }
                  value={category.youtube_url}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="flex flex-wrap items-center justify-between gap-2 field-label">
                  <span>Description</span>
                  <span>{category.description.length} characters</span>
                </span>
                <textarea
                  className="field-input min-h-[96px]"
                  onChange={(event) =>
                    updateCategory(category.id, {description: event.target.value})
                  }
                  placeholder="Public context for this project or category."
                  value={category.description}
                />
                {approvedProjectSlugs.includes(category.slug) ? (
                  <span className="block text-xs leading-5 text-muted">
                    Approved public projects need a description before their hub can appear.
                  </span>
                ) : null}
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {approvedProjectSlugs.includes(category.slug) ? (
                <span className="pill border-brand-primary/30 text-brand-primary">
                  Approved public project
                </span>
              ) : (
                <span className="pill">Music category</span>
              )}
              <p className="text-xs text-muted">
                Changing a slug changes its public project URL and can affect saved links.
              </p>
            </div>

            <div className="inset-surface mt-5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="field-label">Attached Releases</p>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    {category.release_ids.length} selected
                  </p>
                </div>
                <span className="pill">{category.slug || slugify(category.name) || "no-slug"}</span>
              </div>

              <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {releaseOptions.map((release) => {
                  const isSelected = category.release_ids.includes(release.id);

                  return (
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                        isSelected
                          ? "border-[rgba(246,201,69,0.4)] bg-[var(--brand-primary-soft)] text-brand-primary"
                          : "border-edge bg-surface text-secondary hover:border-[rgba(246,201,69,0.3)]"
                      }`}
                      key={release.id}
                    >
                      <input
                        checked={isSelected}
                        className="mt-1 h-4 w-4 rounded border-edge bg-input text-brand-primary focus:ring-brand-primary"
                        onChange={() => toggleCategoryRelease(category.id, release.id)}
                        type="checkbox"
                      />
                      <span>
                        <span className="block font-semibold">{release.title}</span>
                        <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-muted">
                          {releaseOptionsById.get(release.id)?.type} / {release.status}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        ))}

        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-edge bg-surface px-5 py-8 text-center text-sm text-muted">
            No manual music categories yet. Add one to create project filters for
            the public music page.
          </div>
        ) : null}
      </div>

      {message ? (
        <div
          className={`rounded-[22px] px-4 py-3 text-sm ${
            saveState === "error"
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
