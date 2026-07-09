"use client";

import {useMemo, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, PlusCircle} from "lucide-react";

import {
  contentTypeOptions,
  formatContentType,
  formatHookType,
  formatSongSection,
  hookTypeOptions,
  songSectionOptions
} from "@/lib/copy";
import type {
  CopyContentType,
  CopySongSection,
  HookType,
  ReleaseSummary
} from "@/lib/types";

type CreateCopyFormState = {
  hook: string;
  caption: string;
  hook_type: HookType;
  content_type: CopyContentType;
  song_section: CopySongSection;
  creative_notes: string;
  release_id: string | null;
};

export function CopyCreateForm({
  initialReleaseId,
  releases
}: {
  initialReleaseId: string | null;
  releases: ReleaseSummary[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<CreateCopyFormState>({
    hook: "",
    caption: "",
    hook_type: "discovery-shock",
    content_type: "amv-lyric-edit",
    song_section: "hook",
    creative_notes: "",
    release_id: initialReleaseId
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedRelease = useMemo(
    () => releases.find((release) => release.id === form.release_id) ?? null,
    [form.release_id, releases]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/copies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as {
        copy?: {id: string};
        message?: string;
      };

      if (!response.ok || !payload.copy) {
        throw new Error(payload.message ?? "Copy creation failed.");
      }

      router.push(`/admin/copy-lab/${payload.copy.id}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Copy creation failed unexpectedly."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="panel px-6 py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Copy Lab</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                New Copy Pair
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Create a new hook and caption pair, add lightweight creative
                strategy tags, and optionally attach it to a release from the start.
              </p>
            </div>

            <Link className="action-button-secondary" href="/admin/copy-lab">
              <ArrowLeft size={16} />
              Back to Copy Lab
            </Link>
          </div>
        </section>

        <form className="panel space-y-6 px-6 py-7" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Copy Angle</span>
              <select
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hook_type: event.target.value as HookType
                  }))
                }
                value={form.hook_type}
              >
                {hookTypeOptions.map((hookType) => (
                  <option key={hookType} value={hookType}>
                    {formatHookType(hookType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Attach to Release</span>
              <select
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    release_id: event.target.value || null
                  }))
                }
                value={form.release_id ?? ""}
              >
                <option value="">No Release / Standalone</option>
                {releases.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <p className="field-label">Creative Strategy</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Copy Lab stores the reusable message: the angle, hook text, caption, and notes. Visuals and song sections are tracked from ad names and Meta imports.
              </p>
            </div>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Creative Notes</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    creative_notes: event.target.value
                  }))
                }
                placeholder="Optional: Monster lock-in angle, AMV scene choice, gym footage, trilingual flex, anime matchup framing..."
                value={form.creative_notes}
              />
            </label>

            <details className="inset-surface group space-y-4 p-4 md:col-span-2">
              <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-semibold text-secondary [&::-webkit-details-marker]:hidden">
                <span>Legacy / Optional Metadata</span>
                <span className="text-xs text-muted group-open:hidden">Show</span>
                <span className="text-xs text-muted hidden group-open:inline">Hide</span>
              </summary>
              <div className="grid gap-5 border-t border-edge pt-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="field-label">Content Type</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        content_type: event.target.value as CopyContentType
                      }))
                    }
                    value={form.content_type}
                  >
                    {contentTypeOptions.map((contentType) => (
                      <option key={contentType} value={contentType}>
                        {formatContentType(contentType)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Song Section</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        song_section: event.target.value as CopySongSection
                      }))
                    }
                    value={form.song_section}
                  >
                    {songSectionOptions.map((songSection) => (
                      <option key={songSection} value={songSection}>
                        {formatSongSection(songSection)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Hook Text</span>
              <textarea
                className="field-input min-h-[140px]"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    hook: event.target.value
                  }))
                }
                placeholder="Lead with the strongest hook here..."
                required
                value={form.hook}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Caption</span>
              <textarea
                className="field-input min-h-[180px]"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    caption: event.target.value
                  }))
                }
                placeholder="Write the supporting caption or body copy here..."
                required
                value={form.caption}
              />
            </label>
          </div>

          <div className="inset-surface px-5 py-5 text-sm text-muted">
            {selectedRelease ? (
              <>
                This copy will be linked to{" "}
                <span className="font-semibold text-ink">{selectedRelease.title}</span>{" "}
                as soon as it is created.
              </>
            ) : (
              <>
                This copy will stay standalone. Use this for reusable copy or anything
                that should not belong to a specific release.
              </>
            )}
          </div>

          {message ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button className="action-button-primary" disabled={isSubmitting} type="submit">
              <PlusCircle size={16} />
              {isSubmitting ? "Creating..." : "Create Copy"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
