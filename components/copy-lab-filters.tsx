"use client";

import {useRouter} from "next/navigation";

export function CopyLabFilters({
  releases,
  activeReleaseId,
  activeGroupBy,
  activeStatusFilter
}: {
  releases: Array<{ id: string; title: string }>;
  activeReleaseId: string | null;
  activeGroupBy: string;
  activeStatusFilter: string;
}) {
  const router = useRouter();

  function handleReleaseChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const val = event.target.value;
    updateFilters(val || null, activeStatusFilter);
  }

  function handleStatusChange(status: string) {
    updateFilters(activeReleaseId, status);
  }

  function updateFilters(releaseId: string | null, statusFilter: string | null) {
    const params = new URLSearchParams();
    if (activeGroupBy && activeGroupBy !== "release") {
      params.set("groupBy", activeGroupBy);
    } else if (activeGroupBy) {
      params.set("groupBy", activeGroupBy);
    }
    if (releaseId) {
      params.set("releaseId", releaseId);
    }
    if (statusFilter && statusFilter !== "all") {
      params.set("statusFilter", statusFilter);
    }

    router.push(`/admin/copy-lab?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="flex flex-col gap-1.5 min-w-[240px]">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">
          Release Context
        </span>
        <select
          className="field-input w-full bg-[#151820] border-[#30343b] text-ink focus:border-[#d7b45e]"
          onChange={handleReleaseChange}
          value={activeReleaseId || ""}
        >
          <option value="">All Releases</option>
          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">
          Linkage Status
        </span>
        <div className="flex rounded-full border border-[#252a31] bg-[#0e1116] p-1">
          {[
            { key: "all", label: "All" },
            { key: "linked", label: "Linked (Direct + Carried)" },
            { key: "direct", label: "Direct Link" },
            { key: "carryover", label: "Carried Link" },
            { key: "unused", label: "Unused" }
          ].map((item) => {
            const isActive = activeStatusFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleStatusChange(item.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] transition ${
                  isActive
                    ? "bg-[#d7b45e] text-[#15120a] shadow-[0_0_0_1px_rgba(215,180,94,0.2)]"
                    : "text-[#d9dee5] hover:text-[#f1dfad]"
                }`}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
