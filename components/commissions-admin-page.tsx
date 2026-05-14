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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="pb-3 pl-2 font-medium">Date</th>
              <th className="pb-3 font-medium">Client</th>
              <th className="pb-3 font-medium">Type</th>
              <th className="pb-3 font-medium">Budget</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.map((req) => (
              <tr key={req.id} className="group hover:bg-slate-50/50">
                <td className="py-4 pl-2 text-slate-500">
                  {new Date(req.createdAt).toLocaleDateString()}
                </td>
                <td className="py-4">
                  <div className="font-medium text-ink">{req.name}</div>
                  <div className="text-xs text-slate-500">{req.email}</div>
                </td>
                <td className="py-4 text-slate-600">{req.requestType}</td>
                <td className="py-4 text-slate-600">{req.budgetRange}</td>
                <td className="py-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    req.status === 'New' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10' :
                    req.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' :
                    req.status === 'Delivered' ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/10' :
                    req.status === 'Declined' || req.status === 'Closed' ? 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10' :
                    'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                  }`}>
                    {req.status}
                  </span>
                </td>
                <td className="py-4 pr-2 text-right">
                  <Link
                    href={`/admin/commissions/${req.id}`}
                    className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
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
