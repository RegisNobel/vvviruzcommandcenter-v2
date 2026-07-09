"use client";

import Link from "next/link";
import {useState, useMemo} from "react";
import {Search, Filter, ChevronRight} from "lucide-react";
import type {CommissionRequestRecord} from "@/lib/types";

type Props = {
  initialRequests: CommissionRequestRecord[];
};

export function CommissionsAdminPage({initialRequests}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const filteredRequests = useMemo(() => {
    let filtered = initialRequests;

    if (statusFilter !== "All") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (typeFilter !== "All") {
      filtered = filtered.filter((r) => r.requestType === typeFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.topic.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [initialRequests, searchQuery, statusFilter, typeFilter]);

  return (
    <section className="panel px-6 py-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-ink">All Requests</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search names, emails..."
              className="field-input pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              className="field-input pl-9 appearance-none bg-transparent"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Reviewing">Reviewing</option>
              <option value="Needs Info">Needs Info</option>
              <option value="Quoted">Quoted</option>
              <option value="Accepted">Accepted</option>
              <option value="Paid">Paid</option>
              <option value="In Progress">In Progress</option>
              <option value="Delivered">Delivered</option>
              <option value="Declined">Declined</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              className="field-input pl-9 appearance-none bg-transparent"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Hook">Hook</option>
              <option value="Verse">Verse</option>
              <option value="Full Custom Song">Full Custom Song</option>
              <option value="Collab / Feature Inquiry">Collab / Feature Inquiry</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-surface mobile-scroll-x mt-6">
        <table className="w-full min-w-[800px] text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-edge bg-surface-elevated text-secondary">
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Client</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Budget</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {filteredRequests.map((req) => (
              <tr key={req.id} className="group transition hover:bg-surface-hover">
                <td className="px-6 py-4 text-muted">
                  {new Date(req.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-ink">{req.name}</div>
                  <div className="text-xs text-muted">{req.email}</div>
                </td>
                <td className="px-6 py-4 text-ink">{req.requestType}</td>
                <td className="px-6 py-4 text-ink">{req.budgetRange}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    req.status === 'New' ? 'bg-blue-500/10 border-blue-500/30 text-blue-200' :
                    req.status === 'Paid' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' :
                    req.status === 'Delivered' ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' :
                    req.status === 'Declined' || req.status === 'Closed' ? 'bg-surface-elevated border-edge text-muted' :
                    'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/commissions/${req.id}`}
                    className="inline-flex items-center justify-center rounded-md p-2 text-muted transition hover:bg-surface-hover hover:text-brand-primary"
                  >
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  No commission requests found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
