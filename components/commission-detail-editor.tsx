"use client";

import {useState} from "react";
import {Save, ExternalLink} from "lucide-react";
import type {CommissionRequestRecord} from "@/lib/types";

type Props = {
  initialRequest: CommissionRequestRecord;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function CommissionDetailEditor({initialRequest}: Props) {
  const [request, setRequest] = useState(initialRequest);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaveState("saving");
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/commissions/${request.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: request.status,
          quotedPrice: request.quotedPrice,
          paypalLink: request.paypalLink,
          adminNotes: request.adminNotes,
          deliveryLink: request.deliveryLink
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save.");
      }

      setRequest(data.commission);
      setSaveState("saved");
      setMessage("Commission request updated.");
      
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Save failed unexpectedly.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Client Details & Request Info */}
      <section className="panel space-y-6 px-6 py-7 lg:col-span-2">
        <h2 className="text-xl font-semibold text-[#ece6da] border-b border-[#272b31] pb-4">Request Details</h2>
        
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d]">Client</p>
            <p className="mt-2 text-base font-medium text-[#ece6da]">{request.name}</p>
            <a href={`mailto:${request.email}`} className="text-sm text-[#c9a347] hover:underline">{request.email}</a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d]">Service & Budget</p>
            <p className="mt-2 text-base font-medium text-[#ece6da]">{request.requestType}</p>
            <p className="text-sm text-[#8f959d]">Budget: {request.budgetRange}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d]">Timeline</p>
            <p className="mt-2 text-sm text-[#ece6da]">
              <span className="font-medium">Requested:</span> {request.deadline}
            </p>
            {request.specificDeadline && (
              <p className="text-sm text-[#8f959d]">Specific: {request.specificDeadline}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d]">Usage Intent</p>
            <p className="mt-2 text-sm text-[#ece6da]">{request.usageIntent}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#272b31]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d]">Topic / Concept</p>
          <div className="mt-3 rounded-xl border border-[#272b31] bg-[#16191d] p-4 text-sm text-[#ece6da] whitespace-pre-wrap">
            {request.topic}
          </div>
        </div>

        {request.additionalNotes && (
          <div className="pt-4 border-t border-[#272b31]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d]">Additional Notes</p>
            <div className="mt-3 rounded-xl border border-[#272b31] bg-[#16191d] p-4 text-sm text-[#ece6da] whitespace-pre-wrap">
              {request.additionalNotes}
            </div>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t border-[#272b31]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d] mb-2">Beat Link</p>
            {request.beatLink ? (
              <a href={request.beatLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#c9a347] hover:underline">
                View Beat <ExternalLink size={14} />
              </a>
            ) : (
              <p className="text-sm text-[#8f959d] italic">None provided</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d] mb-2">Reference Link</p>
            {request.referenceLink ? (
              <a href={request.referenceLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#c9a347] hover:underline">
                View Reference <ExternalLink size={14} />
              </a>
            ) : (
              <p className="text-sm text-[#8f959d] italic">None provided</p>
            )}
          </div>
        </div>

        {/* Source Tracking */}
        {(request.utmSource || request.referrer || request.landingPage) && (
          <div className="pt-4 border-t border-[#272b31]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8f959d] mb-3">Attribution Source</p>
            <div className="grid gap-2 text-xs text-[#8f959d] sm:grid-cols-2">
              {request.utmSource && <p>Source: <span className="font-medium text-[#ece6da]">{request.utmSource}</span></p>}
              {request.utmMedium && <p>Medium: <span className="font-medium text-[#ece6da]">{request.utmMedium}</span></p>}
              {request.utmCampaign && <p>Campaign: <span className="font-medium text-[#ece6da]">{request.utmCampaign}</span></p>}
              {request.referrer && <p>Referrer: <span className="font-medium text-[#ece6da]">{request.referrer}</span></p>}
              {request.landingPage && <p>Landing Page: <span className="font-medium text-[#ece6da]">{request.landingPage}</span></p>}
            </div>
          </div>
        )}
      </section>

      {/* Admin Management Sidebar */}
      <section className="panel space-y-6 px-6 py-7 h-fit sticky top-6">
        <div className="flex items-center justify-between border-b border-[#272b31] pb-4">
          <h2 className="text-xl font-semibold text-[#ece6da]">Management</h2>
          <button
            type="button"
            className="action-button-primary !py-2 !px-3"
            onClick={handleSave}
            disabled={saveState === "saving"}
          >
            <Save size={16} />
            {saveState === "saving" ? "Saving..." : "Save"}
          </button>
        </div>

        {message && (
          <div className={`rounded-xl border px-3 py-2 text-sm ${
            saveState === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
          }`}>
            {message}
          </div>
        )}

        <label className="block space-y-2">
          <span className="field-label">Status</span>
          <select
            className="field-input"
            value={request.status}
            onChange={(e) => setRequest({ ...request, status: e.target.value })}
          >
            <option value="New">New</option>
            <option value="Reviewing">Reviewing</option>
            <option value="Needs Info">Needs Info</option>
            <option value="Quoted">Quoted</option>
            <option value="Accepted">Accepted</option>
            <option value="Paid">Paid (Manual)</option>
            <option value="In Progress">In Progress</option>
            <option value="Delivered">Delivered</option>
            <option value="Declined">Declined</option>
            <option value="Closed">Closed</option>
          </select>
          {request.status === "Paid" && (
            <p className="text-xs text-amber-600 font-medium mt-1">
              Marking Paid means you have verified funds in PayPal externally.
            </p>
          )}
        </label>

        <label className="block space-y-2">
          <span className="field-label">Quoted Price</span>
          <input
            type="text"
            className="field-input"
            placeholder="e.g. $150 USD"
            value={request.quotedPrice}
            onChange={(e) => setRequest({ ...request, quotedPrice: e.target.value })}
          />
        </label>

        <label className="block space-y-2">
          <span className="field-label">PayPal Link</span>
          <input
            type="url"
            className="field-input"
            placeholder="https://paypal.me/..."
            value={request.paypalLink}
            onChange={(e) => setRequest({ ...request, paypalLink: e.target.value })}
          />
          <p className="text-xs text-[#8f959d]">Copy this manually to send to the client.</p>
        </label>

        <label className="block space-y-2">
          <span className="field-label">Delivery Link</span>
          <input
            type="url"
            className="field-input"
            placeholder="Drive/Dropbox link"
            value={request.deliveryLink}
            onChange={(e) => setRequest({ ...request, deliveryLink: e.target.value })}
          />
        </label>

        <label className="block space-y-2">
          <span className="field-label">Admin Notes (Private)</span>
          <textarea
            className="field-input min-h-[120px]"
            placeholder="Notes on the project, pricing context, splits, etc."
            value={request.adminNotes}
            onChange={(e) => setRequest({ ...request, adminNotes: e.target.value })}
          />
        </label>
      </section>
    </div>
  );
}
