"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft, PlusCircle} from "lucide-react";
import Link from "next/link";

import type {ReleaseType} from "@/lib/types";
import {parseCollaborators} from "@/lib/public-utils";

type CreateFormState = {
  title: string;
  type: ReleaseType;
  release_date: string;
  collaborator: boolean;
  collaborator_name: string;
  upc: string;
  isrc: string;
};

export function ReleaseCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormState>({
    title: "",
    type: "nerdcore",
    release_date: "",
    collaborator: false,
    collaborator_name: "",
    upc: "",
    isrc: ""
  });
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const parsed = parseCollaborators(form.collaborator_name);
    const sanitizedForm = {
      ...form,
      collaborator_name: parsed.join(", ")
    };

    try {
      const response = await fetch("/api/releases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(sanitizedForm)
      });
      const payload = (await response.json()) as {
        release?: {id: string};
        message?: string;
      };

      if (!response.ok || !payload.release) {
        throw new Error(payload.message ?? "Release creation failed.");
      }

      router.push(`/admin/releases/${payload.release.id}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Release creation failed unexpectedly."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="panel px-6 py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Releases</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                New Release
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                Start a release entry with the basics first. You&apos;ll land on the
                detail page right after creation.
              </p>
            </div>

            <Link className="action-button-secondary" href="/admin/releases">
              <ArrowLeft size={16} />
              Back to Releases
            </Link>
          </div>
        </section>

        <form className="panel space-y-6 px-6 py-7" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder="Release title"
                required
                value={form.title}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Type</span>
              <select
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as ReleaseType
                  }))
                }
                value={form.type}
              >
                <option value="nerdcore">Nerdcore</option>
                <option value="mainstream">Mainstream</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Release Date</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    release_date: event.target.value
                  }))
                }
                type="date"
                value={form.release_date}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Collaborators</span>
              <select
                className="field-input"
                onChange={(event) => {
                  const isYes = event.target.value === "yes";
                  if (!isYes) {
                    setCollaborators([]);
                  } else {
                    setCollaborators([""]);
                  }
                  setForm((current) => ({
                    ...current,
                    collaborator: isYes,
                    collaborator_name: ""
                  }));
                }}
                value={form.collaborator ? "yes" : "no"}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            {form.collaborator ? (
              <div className="space-y-3 pb-2">
                <span className="field-label block">Collaborators List</span>
                <div className="space-y-2">
                  {collaborators.map((name, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        className="field-input flex-1"
                        onChange={(event) => {
                          const updated = [...collaborators];
                          updated[index] = event.target.value;
                          setCollaborators(updated);
                          setForm((current) => ({
                            ...current,
                            collaborator_name: updated.join(",")
                          }));
                        }}
                        placeholder={`Collaborator #${index + 1}`}
                        value={name}
                      />
                      {collaborators.length > 1 && (
                        <button
                          type="button"
                          className="action-button-danger !px-3 !py-2 text-xs"
                          onClick={() => {
                            const updated = collaborators.filter((_, i) => i !== index);
                            setCollaborators(updated);
                            setForm((current) => ({
                              ...current,
                              collaborator_name: updated.join(",")
                            }));
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {collaborators.length < 10 && (
                    <button
                      type="button"
                      className="action-button-secondary !px-3 !py-1.5 text-xs uppercase tracking-wider text-brand-primary hover:border-[rgba(246,201,69,0.42)]"
                      onClick={() => {
                        const updated = [...collaborators, ""];
                        setCollaborators(updated);
                        setForm((current) => ({
                          ...current,
                          collaborator_name: updated.join(",")
                        }));
                      }}
                    >
                      + Add Collaborator
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <label className="space-y-2">
              <span className="field-label">UPC</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    upc: event.target.value
                  }))
                }
                placeholder="Optional UPC"
                value={form.upc}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">ISRC</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isrc: event.target.value
                  }))
                }
                placeholder="Optional ISRC"
                value={form.isrc}
              />
            </label>
          </div>

          {message ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button className="action-button-primary" disabled={isSubmitting} type="submit">
              <PlusCircle size={16} />
              {isSubmitting ? "Creating..." : "Create Release"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
