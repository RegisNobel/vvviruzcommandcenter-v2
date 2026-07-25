"use client";

import {useRouter} from "next/navigation";

import {ReleasePicker} from "@/components/release-picker";

export function CopyLabFilters({
  releases,
  activeReleaseId,
  activeGroupBy,
  activeStatusFilter,
  activeArchiveFilter
}: {
  releases: Array<{ id: string; title: string }>;
  activeReleaseId: string | null;
  activeGroupBy: string;
  activeStatusFilter: string;
  activeArchiveFilter: string;
}) {
  const router = useRouter();

  function handleReleaseChange(val: string) {
    updateFilters(val || null, activeStatusFilter, activeArchiveFilter);
  }

  function handleStatusChange(status: string) {
    updateFilters(activeReleaseId, status, activeArchiveFilter);
  }

  function handleArchiveChange(event: React.ChangeEvent<HTMLSelectElement>) {
    updateFilters(activeReleaseId, activeStatusFilter, event.target.value);
  }

  function updateFilters(
    releaseId: string | null,
    statusFilter: string | null,
    archiveFilter: string | null
  ) {
    const params = new URLSearchParams();
    if (activeGroupBy) {
      params.set("groupBy", activeGroupBy);
    }
    if (releaseId) {
      params.set("releaseId", releaseId);
    }
    if (statusFilter && statusFilter !== "all") {
      params.set("statusFilter", statusFilter);
    }
    if (archiveFilter && archiveFilter !== "active") {
      params.set("archiveFilter", archiveFilter);
    }

    router.push(`/admin/copy-lab?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          Release Context
        </span>
        <ReleasePicker
          ariaLabel="Filter Copy Lab by release"
          emptyOption={{label: "All Releases", value: ""}}
          onValueChange={handleReleaseChange}
          releases={releases}
          value={activeReleaseId || ""}
        />
      </div>

      <div className="flex flex-col gap-1.5 min-w-[160px]">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          Archive State
        </span>
        <select
          className="field-input w-full"
          onChange={handleArchiveChange}
          value={activeArchiveFilter}
        >
          <option value="active">Active Only</option>
          <option value="archived">Archived Only</option>
          <option value="all">Show All</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
          Linkage Status
        </span>
        <div className="flex flex-wrap rounded-md border border-edge bg-input p-1">
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
                className={`rounded-md px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] transition ${
                  isActive
                    ? "bg-brand-primary text-inverse shadow-[0_0_0_1px_rgba(246,201,69,0.18)]"
                    : "text-secondary hover:bg-surface-hover hover:text-ink"
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
