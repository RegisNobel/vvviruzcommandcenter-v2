import Link from "next/link";
import Image from "next/image";
import {UserPlus} from "lucide-react";
import type {AppearsOnRecord} from "@/lib/types";

function AppearsOnTable({records}: {records: AppearsOnRecord[]}) {
  if (!records.length) {
    return (
      <div className="p-8 text-center text-sm text-muted">
        No entries in this section.
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm text-ink">
      <thead className="border-b border-edge bg-input text-muted">
        <tr>
          <th className="px-6 py-4 font-semibold">Track</th>
          <th className="px-6 py-4 font-semibold">Artists</th>
          <th className="px-6 py-4 font-semibold">Date</th>
          <th className="px-6 py-4 font-semibold">Status</th>
          <th className="px-6 py-4 font-semibold">Order</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-edge">
        {records.map((record) => (
          <tr className="transition hover:bg-surface-hover" key={record.id}>
            <td className="px-6 py-4">
              <Link className="group flex items-center gap-4" href={`/admin/appears-on/${record.id}`}>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-input">
                  {record.cover_art_url ? (
                    <Image src={record.cover_art_url} alt="" fill className="object-cover" unoptimized />
                  ) : null}
                </div>
                <span className="font-semibold transition group-hover:text-brand-primary">
                  {record.title}
                </span>
              </Link>
            </td>
            <td className="px-6 py-4">{record.artists}</td>
            <td className="px-6 py-4 text-muted">{record.release_date || "Not set"}</td>
            <td className="px-6 py-4">
              {record.archived_at ? (
                <span className="status-badge-neutral">Archived</span>
              ) : record.is_published ? (
                <span className="status-badge-ready">Published</span>
              ) : (
                <span className="status-badge-neutral">Draft</span>
              )}
            </td>
            <td className="px-6 py-4">{record.sort_order}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AppearsOnSettingsPanel({records}: {records: AppearsOnRecord[]}) {
  const currentRecords = records.filter((record) => !record.archived_at);
  const archivedRecords = records.filter((record) => Boolean(record.archived_at));

  return (
    <section
      className="command-surface scroll-mt-36 space-y-6 px-5 py-6 sm:px-6 sm:py-7"
      id="appears-on"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="pill">
            <UserPlus size={12} />
            Appears On
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Features & Collaborations
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Manage external features to display on the public music page.
          </p>
        </div>

        <Link className="action-button-primary" href="/admin/appears-on/create">
          Add Feature
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-edge bg-surface-elevated">
        {currentRecords.length === 0 ? (
          <div className="p-12 text-center text-muted">
            No Appears On entries yet. Click &quot;Add Feature&quot; to get started.
          </div>
        ) : (
          <AppearsOnTable records={currentRecords} />
        )}
      </div>

      <details className="border-t border-edge pt-5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Archived appearances / {archivedRecords.length}
        </summary>
        <div className="mt-4 overflow-x-auto rounded-lg border border-edge bg-surface-elevated">
          <AppearsOnTable records={archivedRecords} />
        </div>
      </details>
    </section>
  );
}
