import Link from "next/link";
import Image from "next/image";
import {UserPlus} from "lucide-react";
import type {AppearsOnRecord} from "@/lib/types";

export function AppearsOnSettingsPanel({records}: {records: AppearsOnRecord[]}) {
  return (
    <section className="panel space-y-6 px-6 py-7">
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

      <div className="mt-8 rounded-2xl border border-[#272b31] bg-[#101215] overflow-hidden">
        {records.length === 0 ? (
          <div className="p-12 text-center text-[#8f959d]">
            No Appears On entries yet. Click &quot;Add Feature&quot; to get started.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-[#ece6da]">
            <thead className="border-b border-[#272b31] bg-[#16191d] text-[#8f959d]">
              <tr>
                <th className="px-6 py-4 font-semibold">Track</th>
                <th className="px-6 py-4 font-semibold">Artists</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272b31]">
              {records.map((record) => (
                <tr className="transition hover:bg-[#16191d]" key={record.id}>
                  <td className="px-6 py-4">
                    <Link className="flex items-center gap-4 group" href={`/admin/appears-on/${record.id}`}>
                      <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-[#1a1d24]">
                        {record.cover_art_url && (
                          <Image src={record.cover_art_url} alt="" fill className="object-cover" unoptimized />
                        )}
                      </div>
                      <span className="font-semibold group-hover:text-[#c9a347] transition">
                        {record.title}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4">{record.artists}</td>
                  <td className="px-6 py-4">
                    {record.is_published ? (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">Published</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[#8f959d]">Draft</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{record.sort_order}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
