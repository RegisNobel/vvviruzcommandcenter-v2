"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft, PlusCircle} from "lucide-react";
import Link from "next/link";

import type {ReleaseType} from "@/lib/types";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/releases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
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
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
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
              <span className="field-label">Collaborator</span>
              <select
                className="field-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    collaborator: event.target.value === "yes",
                    collaborator_name:
                      event.target.value === "yes" ? current.collaborator_name : ""
                  }))
                }
                value={form.collaborator ? "yes" : "no"}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            {form.collaborator ? (
              <label className="space-y-2">
                <span className="field-label">Collaborator Name</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      collaborator_name: event.target.value
                    }))
                  }
                  placeholder="Who are you working with?"
                  value={form.collaborator_name}
                />
              </label>
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
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
