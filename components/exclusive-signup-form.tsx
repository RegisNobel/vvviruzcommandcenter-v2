"use client";

import {useState} from "react";
import {CheckCircle2, Download, Loader2, Mail} from "lucide-react";

type ExclusiveSignupFormProps = {
  consentLabel: string;
  ctaLabel: string;
  downloadLabel: string;
  emailLabel: string;
  nameLabel: string;
  successHeading: string;
  trackTitle: string;
};

type SaveState = "idle" | "submitting" | "success" | "error";

export function ExclusiveSignupForm({
  consentLabel,
  ctaLabel,
  downloadLabel,
  emailLabel,
  nameLabel,
  successHeading,
  trackTitle
}: ExclusiveSignupFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [privateExternalUrl, setPrivateExternalUrl] = useState("");
  const [unlockExperience, setUnlockExperience] = useState<"instant_unlock" | "email_only">("instant_unlock");
  const [instantUnlockButtonLabel, setInstantUnlockButtonLabel] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          consent_given: consentGiven
        })
      });
      const payload = (await response.json()) as {
        downloadUrl?: string;
        privateExternalUrl?: string;
        unlockExperience?: "instant_unlock" | "email_only";
        instantUnlockButtonLabel?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to unlock the track right now.");
      }

      setDownloadUrl(payload.downloadUrl || "");
      setPrivateExternalUrl(payload.privateExternalUrl || "");
      setUnlockExperience(payload.unlockExperience || "instant_unlock");
      setInstantUnlockButtonLabel(payload.instantUnlockButtonLabel || "Listen Now");
      setMessage(payload.message ?? "Your download is unlocked below.");
      setSaveState("success");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Unable to unlock the track right now.");
    }
  }

  if (saveState === "success") {
    return (
      <div className="rounded-[28px] border border-emerald-400/22 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(12,15,19,0.96))] p-6 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/12 text-emerald-200">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#f7f1e6]">
          {successHeading}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#c3ccd5]">{message}</p>
        
        {unlockExperience === "instant_unlock" ? (
          <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d2af5a]">
              Unlocked Track
            </p>
            <p className="mt-3 text-xl font-semibold text-[#f7f1e6]">{trackTitle}</p>
            {privateExternalUrl ? (
              <a
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#c9a347]/40 bg-[#c9a347]/14 px-5 py-3 text-sm font-semibold text-[#f2dfb0] transition hover:border-[#c9a347]/60 hover:bg-[#c9a347]/20"
                href={privateExternalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {instantUnlockButtonLabel}
              </a>
            ) : downloadUrl ? (
              <a
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#c9a347]/40 bg-[#c9a347]/14 px-5 py-3 text-sm font-semibold text-[#f2dfb0] transition hover:border-[#c9a347]/60 hover:bg-[#c9a347]/20"
                href={downloadUrl}
              >
                <Download size={16} />
                {downloadLabel}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="field-label">{nameLabel}</span>
        <input
          className="field-input"
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          required
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#c9a347]/36 bg-[#c9a347] px-5 py-3 text-sm font-semibold text-[#13161a] transition hover:scale-[1.01] hover:bg-[#d8b761] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={saveState === "submitting"}
        type="submit"
      >
        {saveState === "submitting" ? <Loader2 className="animate-spin" size={16} /> : null}
        {ctaLabel}
      </button>

      {message ? (
        <p
          className={`text-sm leading-6 ${
            saveState === "error" ? "text-[#f3b0b0]" : "text-[#c3ccd5]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

