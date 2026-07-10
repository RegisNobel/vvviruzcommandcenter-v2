"use client";

import {useState} from "react";
import {CheckCircle2, Loader2, Mail} from "lucide-react";

type UnlockExperience = "instant_unlock" | "email_only" | "signup_notify";

type ExclusiveSignupFormProps = {
  consentLabel: string;
  ctaLabel: string;
  downloadLabel?: string;
  emailLabel: string;
  nameLabel: string;
  successHeading: string;
  trackTitle?: string;
  unlockExperience?: UnlockExperience;
};

type SaveState = "idle" | "submitting" | "success" | "error";

function getSuccessFallbackMessage(unlockExperience: UnlockExperience) {
  if (unlockExperience === "email_only") {
    return "You're in. Check your email for the preview.";
  }

  if (unlockExperience === "signup_notify") {
    return "You're in. I'll send the preview/update when it's ready.";
  }

  return "You're in. Your preview is unlocked.";
}

export function ExclusiveSignupForm({
  consentLabel,
  ctaLabel,
  downloadLabel,
  emailLabel,
  nameLabel,
  successHeading,
  trackTitle,
  unlockExperience: initialUnlockExperience = "instant_unlock"
}: ExclusiveSignupFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const botTestField = String(formData.get("bot_test_field") ?? "");

    setSaveState("submitting");
    setMessage(null);

    try {
      const response = await fetch("/api/exclusive/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          consent_given: consentGiven,
          bot_test_field: botTestField,
          source_utm_source: new URLSearchParams(window.location.search).get("utm_source") || "",
          source_utm_medium: new URLSearchParams(window.location.search).get("utm_medium") || "",
          source_utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") || "",
          source_utm_content: new URLSearchParams(window.location.search).get("utm_content") || "",
          source_utm_term: new URLSearchParams(window.location.search).get("utm_term") || "",
          source_referrer: document.referrer || "",
          source_landing_page: window.location.pathname || ""
        })
      });
      const payload = (await response.json()) as {
        success?: boolean;
        accessUrl?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to join the list right now.");
      }

      if (payload.accessUrl) {
        window.location.reload();
        return;
      }

      setMessage(payload.message ?? getSuccessFallbackMessage(initialUnlockExperience));
      setSaveState("success");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Unable to join the list right now.");
    }
  }

  if (saveState === "success") {
    return (
      <div className="state-panel-success flex-col rounded-[28px] bg-[linear-gradient(145deg,var(--status-success-soft),rgba(12,15,19,0.96))] p-6 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/12 text-emerald-200">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#f7f1e6]">
          {successHeading}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#c3ccd5]">{message}</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div
        aria-hidden="true"
        className="absolute -left-[100vw] top-auto h-px w-px overflow-hidden opacity-0"
      >
        <label>
          Leave this field blank
          <input
            autoComplete="off"
            className="h-px w-px"
            name="bot_test_field"
            tabIndex={-1}
            type="text"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="field-label">{nameLabel}</span>
        <input
          className="field-input"
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          value={name}
        />
      </label>

      <label className="block space-y-2">
        <span className="field-label">{emailLabel}</span>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7c838c]"
            size={16}
          />
          <input
            className="field-input pl-11"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>
      </label>

      <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-[#0f1217]/78 px-4 py-4 text-sm leading-6 text-[#c5cdd6]">
        <input
          checked={consentGiven}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347]"
          onChange={(event) => setConsentGiven(event.target.checked)}
          type="checkbox"
        />
        <span>{consentLabel}</span>
      </label>

        <button
          className="public-action-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
        disabled={saveState === "submitting"}
        type="submit"
      >
        {saveState === "submitting" ? <Loader2 className="animate-spin" size={16} /> : null}
        {ctaLabel}
      </button>

      {message ? (
        <p className={saveState === "error" ? "state-message-danger" : "state-message"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
