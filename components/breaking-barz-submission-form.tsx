"use client";

import {useState} from "react";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function BreakingBarzSubmissionForm() {
  const [state, setState] = useState<SubmissionState>("idle");
  const [message, setMessage] = useState("");

  async function submitSuggestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/breaking-barz/submissions", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(Object.fromEntries(data.entries()))
      });
      const payload = (await response.json()) as {message?: string};
      if (!response.ok) throw new Error(payload.message || "Suggestion could not be sent.");
      form.reset();
      setState("success");
      setMessage(payload.message || "Suggestion received for review.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Suggestion could not be sent.");
    }
  }

  return (
    <form className="public-panel space-y-5 p-5 sm:p-7" onSubmit={submitSuggestion}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="public-eyebrow">Song title</span>
          <input className="field-input" maxLength={160} name="songTitle" required />
        </label>
        <label className="space-y-2">
          <span className="public-eyebrow">Artist or artists</span>
          <input
            className="field-input"
            maxLength={300}
            name="artistNames"
            placeholder="Separate multiple artists with commas"
            required
          />
        </label>
      </div>
      <label className="space-y-2">
        <span className="public-eyebrow">A couple of lines</span>
        <textarea className="field-input min-h-32" maxLength={600} name="lyricExcerpt" required />
      </label>
      <label className="space-y-2">
        <span className="public-eyebrow">What do you think they mean? (optional)</span>
        <textarea className="field-input min-h-24" maxLength={300} name="summary" />
      </label>
      <label className="space-y-2">
        <span className="public-eyebrow">More context (optional)</span>
        <textarea className="field-input min-h-32" maxLength={4000} name="breakdown" />
      </label>
      <label className="space-y-2">
        <span className="public-eyebrow">Song link (optional)</span>
        <input className="field-input" name="songUrl" placeholder="https://" type="url" />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="public-eyebrow">Your name (optional)</span>
          <input className="field-input" maxLength={120} name="submitterName" />
        </label>
        <label className="space-y-2">
          <span className="public-eyebrow">Your email (optional)</span>
          <input className="field-input" maxLength={320} name="submitterEmail" type="email" />
        </label>
      </div>
      <label className="absolute left-[-9999px]" aria-hidden="true">
        Website
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>
      <p className="text-xs leading-5 text-[#8f98a5]">
        Suggestions are private. Nothing appears publicly until it is reviewed and approved.
      </p>
      <button className="public-action-primary" disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Sending..." : "Send suggestion"}
      </button>
      {message ? (
        <p aria-live="polite" className={state === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
