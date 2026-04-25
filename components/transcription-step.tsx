"use client";

import {LoaderCircle, Sparkles, Wand2} from "lucide-react";

import type {TranscriptionLanguage, TranscriptionStatus} from "@/lib/types";

type TranscriptionStepProps = {
  status: TranscriptionStatus;
  language: TranscriptionLanguage;
  message: string | null;
  isTranscribing: boolean;
  onLanguageChange: (language: TranscriptionLanguage) => void;
  onRetry: () => void | Promise<void>;
  onContinue: () => void;
};

export function TranscriptionStep({
  status,
  language,
  message,
  isTranscribing,
  onLanguageChange,
  onRetry,
  onContinue
}: TranscriptionStepProps) {
  const heading =
    status === "complete"
      ? "Transcription complete"
      : status === "failed"
        ? "Transcription needs another pass"
        : "Auto-transcribing your clip";

  const detail =
    status === "complete"
      ? "The lyrics are synced and ready for cleanup."
      : status === "failed"
        ? "Whisper hit an issue. Retry the pass and continue once the lines are ready."
        : "Video Lab is running local Whisper and grouping words into editable lyric lines.";

  return (
    <section className="panel p-6">
      <div className="panel-header">
        <div>
          <p className="field-label">Transcription</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">{heading}</h2>
        </div>
        <span className="pill">
          <Sparkles size={12} />
          Whisper.cpp
        </span>
      </div>

      <div className="mt-5 rounded-[28px] border border-slate-200/70 bg-white/75 p-6">
        <div className="mb-6 grid gap-3 rounded-[22px] border border-slate-200/70 bg-white/80 p-4">
          <label className="space-y-2">
            <span className="field-label">Lyric language</span>
            <select
              className="field-input"
              disabled={isTranscribing}
              onChange={(event) =>
                onLanguageChange(event.target.value as TranscriptionLanguage)
              }
              value={language}
            >
              <option value="auto">Auto Detect</option>
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </label>
          <p className="text-sm leading-6 text-slate-600">
            Use <strong>Auto Detect</strong> for mixed or bilingual lyrics. English,
            French, and Spanish are supported directly.
          </p>
        </div>

        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-ink p-3 text-white">
            {isTranscribing ? (
              <LoaderCircle className="animate-spin" size={20} />
            ) : (
              <Wand2 size={20} />
            )}
          </div>
          <div className="space-y-3">
            <p className="text-base font-semibold text-slate-900">{detail}</p>
            <p className="text-sm leading-6 text-slate-600">
              {message ??
                "Once transcription finishes, move to the lyric cleanup screen."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {status === "failed" ? (
            <button
              className="action-button-secondary"
              onClick={() => void onRetry()}
              type="button"
            >
              Retry Transcription
            </button>
          ) : null}

          <button
            className="action-button-primary"
            disabled={status !== "complete"}
            onClick={onContinue}
            type="button"
          >
            Continue to Edit
          </button>
        </div>
      </div>
    </section>
  );
}
