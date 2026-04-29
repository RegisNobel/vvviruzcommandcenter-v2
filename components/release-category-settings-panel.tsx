"use client";

import {Layers3, Plus, Save, Trash2} from "lucide-react";
import {useMemo, useState} from "react";

import type {ReleaseCategoryRecord, ReleaseSummary} from "@/lib/types";
import {createId} from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

type ReleaseCategorySettingsPanelProps = {
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
  initialCategories,
  releaseOptions
}: ReleaseCategorySettingsPanelProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [saveState, setSaveState] = useState<SaveState>("idle");
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
    <section className="panel space-y-6 px-6 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="pill">
            <Layers3 size={12} />
            Music Categories
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Public music project filters
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Add manual project categories like Multiversus, Switch Series, or Lover
            Boy EP, then attach existing releases so visitors can filter the public
            music page by project.
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
            Add Category
          </button>
          <button className="action-button-primary" onClick={() => void saveCategories()} type="button">
            <Save size={16} />
            Save Categories
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {categories.map((category, index) => (
          <section
            className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5"
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
                <span className="field-label">Category Name</span>
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

              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Description</span>
                <textarea
                  className="field-input min-h-[96px]"
                  onChange={(event) =>
                    updateCategory(category.id, {description: event.target.value})
                  }
                  placeholder="Optional public context for this project/category."
                  value={category.description}
                />
              </label>
            </div>

            <div className="mt-5 rounded-[22px] border border-[#30343b] bg-[#0f1217] p-4">
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
                      className={`flex cursor-pointer items-start gap-3 rounded-[18px] border px-3 py-3 text-sm transition ${
                        isSelected
                          ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                          : "border-[#30343b] bg-[#121418] text-[#d5d9df] hover:border-[#545962]"
                      }`}
                      key={release.id}
                    >
                      <input
                        checked={isSelected}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347]"
                        onChange={() => toggleCategoryRelease(category.id, release.id)}
                        type="checkbox"
                      />
                      <span>
                        <span className="block font-semibold">{release.title}</span>
                        <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-[#8f959d]">
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
          <div className="rounded-[24px] border border-dashed border-[#30343b] bg-[#121418] px-5 py-8 text-center text-sm text-muted">
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
