"use client";

import {useState} from "react";
import {CheckCircle2, Send} from "lucide-react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function CommissionRequestForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitState === "submitting") return;

    setSubmitState("submitting");
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    // Add source tracking params from URL if available
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      payload.source_utm_source = searchParams.get("utm_source") || "";
      payload.source_utm_medium = searchParams.get("utm_medium") || "";
      payload.source_utm_campaign = searchParams.get("utm_campaign") || "";
      payload.source_utm_content = searchParams.get("utm_content") || "";
      payload.source_utm_term = searchParams.get("utm_term") || "";
      payload.source_landing_page = window.location.pathname;
    }

    try {
      const response = await fetch("/api/commissions/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit request.");
      }

      setSubmitState("success");
      setMessage(data.message || "Request received. I'll review it and reply with next steps if it's a fit.");
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (submitState === "success") {
    return (
      <div className="rounded-[32px] border border-white/10 bg-[#0c1015]/82 p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="mt-6 text-2xl font-semibold text-white">Request Received</h3>
        <p className="mt-4 text-slate-300">{message}</p>
      </div>
    );
  }

  return (
    <form
      className="rounded-[32px] border border-white/10 bg-[#0c1015]/82 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-10"
      onSubmit={handleSubmit}
    >
      <h3 className="mb-6 text-2xl font-semibold text-white">Start a Request</h3>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Honeypot */}
        <input
          aria-hidden="true"
          className="hidden"
          name="bot_test_field"
          tabIndex={-1}
          type="text"
        />

        <label className="space-y-2">
          <span className="field-label text-white/80">Name</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="name"
            placeholder="Your name or artist name"
            required
            type="text"
          />
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Email</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="email"
            placeholder="For communication & quote"
            required
            type="email"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label text-white/80">Request Type</span>
          <select className="field-input bg-black/40 text-white" name="requestType" required defaultValue="">
            <option disabled value="">Select a service...</option>
            <option value="Hook / Verse">Hook / Verse</option>
            <option value="Full Custom Song">Full Custom Song</option>
            <option value="Collab / Feature Inquiry">Collab / Feature Inquiry</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Budget Range</span>
          <select className="field-input bg-black/40 text-white" name="budgetRange" required defaultValue="">
            <option disabled value="">Select a range...</option>
            <option value="$50">$50</option>
            <option value="$100">$100</option>
            <option value="$100 - $250">$100 - $250</option>
            <option value="$250+">$250+</option>
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Usage Intent</span>
          <select className="field-input bg-black/40 text-white" name="usageIntent" required defaultValue="">
            <option disabled value="">Select intent...</option>
            <option value="Personal">Personal</option>
            <option value="Commercial release">Commercial release</option>
            <option value="YouTube / social content">YouTube / social content</option>
            <option value="Gift">Gift</option>
            <option value="Brand / project">Brand / project</option>
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Deadline</span>
          <select className="field-input bg-black/40 text-white" name="deadline" required defaultValue="">
            <option disabled value="">Select deadline...</option>
            <option value="No rush">No rush</option>
            <option value="1 week">1 week</option>
            <option value="2 weeks">2 weeks</option>
            <option value="1 month">1 month</option>
            <option value="Specific date">Specific date</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Specific Date (Optional)</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="specificDeadline"
            placeholder="e.g., Oct 31st"
            type="text"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label text-white/80">Topic / Concept</span>
          <textarea
            className="field-input min-h-[100px] bg-black/40 text-white placeholder:text-white/30"
            name="topic"
            placeholder="What is the song about? Describe the story, character, or vibe you want."
            required
          />
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Beat Link (Optional)</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="beatLink"
            placeholder="YouTube, Soundcloud, Drive, etc."
            type="url"
          />
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">Reference Link (Optional)</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="referenceLink"
            placeholder="A song with a similar vibe"
            type="url"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label text-white/80">Additional Notes (Optional)</span>
          <textarea
            className="field-input min-h-[80px] bg-black/40 text-white placeholder:text-white/30"
            name="additionalNotes"
            placeholder="Any extra details or requests?"
          />
        </label>
      </div>

      {submitState === "error" && message && (
        <div className="mt-6 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 border border-rose-500/20">
          {message}
        </div>
      )}

      <button
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a347] px-6 py-4 text-base font-semibold text-black transition hover:bg-[#d7b663] disabled:opacity-50"
        disabled={submitState === "submitting"}
        type="submit"
      >
        <Send size={20} />
        {submitState === "submitting" ? "Submitting..." : "Submit Request"}
      </button>

      <p className="mt-4 text-center text-xs leading-5 text-white/50">
        Submitting a request does not guarantee acceptance. Custom work is reviewed before approval.
        Payment is handled externally through PayPal for now.
      </p>
    </form>
  );
}
