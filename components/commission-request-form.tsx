"use client";

import {useState} from "react";
import {CheckCircle2, Send} from "lucide-react";
import type {SiteContentSettings} from "@/lib/types";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function CommissionRequestForm({
  content
}: {
  content: SiteContentSettings["commissions"];
}) {
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
      <div className="public-form-surface p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="mt-6 text-2xl font-semibold text-white">
          {content.form_success_heading}
        </h3>
        <p className="mt-4 text-slate-300">{message}</p>
      </div>
    );
  }

  return (
    <form
      className="public-form-surface p-6 sm:p-10"
      onSubmit={handleSubmit}
    >
      <h3 className="mb-6 text-2xl font-semibold text-white">{content.form_heading}</h3>
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
          <span className="field-label text-white/80">{content.name_label}</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="name"
            placeholder={content.name_placeholder}
            required
            type="text"
          />
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.email_label}</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="email"
            placeholder={content.email_placeholder}
            required
            type="email"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label text-white/80">{content.request_type_label}</span>
          <select className="field-input bg-black/40 text-white" name="requestType" required defaultValue="">
            <option disabled value="">{content.request_type_placeholder}</option>
            {content.services.map((service) => (
              <option key={service.id} value={service.title}>{service.title}</option>
            ))}
            <option value={content.other_service_label}>{content.other_service_label}</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.budget_label}</span>
          <select className="field-input bg-black/40 text-white" name="budgetRange" required defaultValue="">
            <option disabled value="">{content.budget_placeholder}</option>
            {content.budget_options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.usage_label}</span>
          <select className="field-input bg-black/40 text-white" name="usageIntent" required defaultValue="">
            <option disabled value="">{content.usage_placeholder}</option>
            {content.usage_options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.deadline_label}</span>
          <select className="field-input bg-black/40 text-white" name="deadline" required defaultValue="">
            <option disabled value="">{content.deadline_placeholder}</option>
            {content.deadline_options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.specific_date_label}</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="specificDeadline"
            placeholder={content.specific_date_placeholder}
            type="text"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label text-white/80">{content.topic_label}</span>
          <textarea
            className="field-input min-h-[100px] bg-black/40 text-white placeholder:text-white/30"
            name="topic"
            placeholder={content.topic_placeholder}
            required
          />
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.beat_link_label}</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="beatLink"
            placeholder={content.beat_link_placeholder}
            type="url"
          />
        </label>

        <label className="space-y-2">
          <span className="field-label text-white/80">{content.reference_link_label}</span>
          <input
            className="field-input bg-black/40 text-white placeholder:text-white/30"
            name="referenceLink"
            placeholder={content.reference_link_placeholder}
            type="url"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label text-white/80">{content.notes_label}</span>
          <textarea
            className="field-input min-h-[80px] bg-black/40 text-white placeholder:text-white/30"
            name="additionalNotes"
            placeholder={content.notes_placeholder}
          />
        </label>
      </div>

      {submitState === "error" && message && (
        <div className="state-panel-danger mt-6">
          {message}
        </div>
      )}

      <button
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a347] px-6 py-4 text-base font-semibold text-black transition hover:bg-[#d7b663] disabled:opacity-50"
        disabled={submitState === "submitting"}
        type="submit"
      >
        <Send size={20} />
        {submitState === "submitting" ? content.submitting_label : content.submit_label}
      </button>

      <p className="mt-4 text-center text-xs leading-5 text-white/50">
        {content.form_disclaimer}
      </p>
    </form>
  );
}
