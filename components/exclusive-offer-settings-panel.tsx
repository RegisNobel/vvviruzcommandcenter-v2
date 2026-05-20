"use client";

import Image from "next/image";
import {Sparkles, UploadCloud} from "lucide-react";
import {useState} from "react";

import type {SiteSettingsRecord} from "@/lib/types";

type ExclusiveOfferSettings = SiteSettingsRecord["site_content"]["exclusive"];

type ExclusiveOfferSettingsPanelProps = {
  exclusiveOffer: ExclusiveOfferSettings;
  onChange: (exclusiveOffer: ExclusiveOfferSettings) => void;
  initialTrackArtOptions: string[];
  initialTrackFileOptions: string[];
};

type UploadState = "idle" | "uploading" | "saved" | "error";

function toExclusiveArtUrl(fileName: string) {
  return `/api/assets/exclusive-art/${fileName}`;
}

function getStoredFileName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split("/");

  return parts[parts.length - 1] ?? trimmed;
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as
    | (T & {message?: string})
    | {message?: string}
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed.");
  }

  return payload as T & {message?: string};
}

const UNLOCK_MODE_LABELS: Record<ExclusiveOfferSettings["unlock_experience"], string> = {
  instant_unlock: "Instant Unlock",
  email_only: "Email Only",
  signup_notify: "Notify Me"
};

function getExclusiveOfferPreview(exclusiveOffer: ExclusiveOfferSettings) {
  const hasPrivateUrl = Boolean(exclusiveOffer.private_external_url.trim());
  const hasUploadedPreview = Boolean(exclusiveOffer.exclusive_track_file_path.trim());
  const hasPreviewAccess = hasPrivateUrl || hasUploadedPreview;
  const hasPreviewTitle = Boolean(exclusiveOffer.exclusive_track_title.trim());
  const hasEmailCopy =
    Boolean(exclusiveOffer.email_subject.trim()) && Boolean(exclusiveOffer.email_body.trim());
  const mode = exclusiveOffer.unlock_experience;
  const visitorReceives =
    mode === "signup_notify"
      ? "Signup confirmation only"
      : mode === "email_only"
        ? "Email with preview link"
        : hasPrivateUrl
          ? "Immediate private link"
          : hasUploadedPreview
            ? "Immediate tokenized download"
            : "No immediate access configured";

  if (!exclusiveOffer.exclusive_track_enabled) {
    return {
      modeLabel: UNLOCK_MODE_LABELS[mode],
      visitorReceives: "Unavailable state",
      readiness: "Disabled",
      readinessTone: "neutral"
    };
  }

  if (mode === "signup_notify") {
    return {
      modeLabel: UNLOCK_MODE_LABELS[mode],
      visitorReceives,
      readiness: "Notify mode ready",
      readinessTone: "ready"
    };
  }

  if (!hasPreviewTitle) {
    return {
      modeLabel: UNLOCK_MODE_LABELS[mode],
      visitorReceives,
      readiness: "Needs preview title",
      readinessTone: "warning"
    };
  }

  if (!hasPreviewAccess) {
    return {
      modeLabel: UNLOCK_MODE_LABELS[mode],
      visitorReceives,
      readiness: mode === "instant_unlock"
        ? "Needs private URL or uploaded file for instant unlock"
        : "Needs private URL or uploaded file for email delivery",
      readinessTone: "warning"
    };
  }

  if ((mode === "email_only" || (mode === "instant_unlock" && exclusiveOffer.also_email_link)) && !hasEmailCopy) {
    return {
      modeLabel: UNLOCK_MODE_LABELS[mode],
      visitorReceives,
      readiness: "Needs email subject/body",
      readinessTone: "warning"
    };
  }

  return {
    modeLabel: UNLOCK_MODE_LABELS[mode],
    visitorReceives,
    readiness: "Ready",
    readinessTone: "ready"
  };
}

export function ExclusiveOfferSettingsPanel({
  exclusiveOffer,
  initialTrackArtOptions,
  initialTrackFileOptions,
  onChange
}: ExclusiveOfferSettingsPanelProps) {
  const [trackFileOptions, setTrackFileOptions] = useState(initialTrackFileOptions);
  const [trackArtOptions, setTrackArtOptions] = useState(initialTrackArtOptions);
  const [trackUploadFile, setTrackUploadFile] = useState<File | null>(null);
  const [artUploadFile, setArtUploadFile] = useState<File | null>(null);
  const [trackUploadState, setTrackUploadState] = useState<UploadState>("idle");
  const [artUploadState, setArtUploadState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function updateExclusiveOffer(patch: Partial<ExclusiveOfferSettings>) {
    onChange({
      ...exclusiveOffer,
      ...patch
    });
  }

  function updateCommunityBenefit(
    benefitIndex: number,
    patch: Partial<ExclusiveOfferSettings["community_benefits"][number]>
  ) {
    updateExclusiveOffer({
      community_benefits: exclusiveOffer.community_benefits.map((benefit, index) =>
        index === benefitIndex ? {...benefit, ...patch} : benefit
      )
    });
  }

  const offerPreview = getExclusiveOfferPreview(exclusiveOffer);

  async function handleUploadAsset(assetType: "track" | "art") {
    const file = assetType === "track" ? trackUploadFile : artUploadFile;

    if (!file) {
      setMessage(
        assetType === "track"
          ? "Choose a track file first."
          : "Choose an artwork file first."
      );
      assetType === "track" ? setTrackUploadState("error") : setArtUploadState("error");

      return;
    }

    assetType === "track" ? setTrackUploadState("uploading") : setArtUploadState("uploading");
    setMessage(null);

    try {
      const formData = new FormData();

      formData.append("assetType", assetType);
      formData.append("file", file);

      const payload = await readJson<{
        assetType: "track" | "art";
        fileName: string;
        storedPath: string;
        publicUrl: string | null;
      }>("/api/exclusive/upload", {
        method: "POST",
        body: formData
      });

      if (assetType === "track") {
        setTrackFileOptions((current) =>
          Array.from(new Set([...current, payload.storedPath])).sort((left, right) =>
            left.localeCompare(right)
          )
        );
        updateExclusiveOffer({
          exclusive_track_file_path: payload.storedPath
        });
        setTrackUploadFile(null);
        setTrackUploadState("saved");
        setMessage("Track uploaded. Save Site Settings to publish the selection.");
      } else {
        const storedFileName = getStoredFileName(payload.storedPath);

        setTrackArtOptions((current) =>
          Array.from(new Set([...current, storedFileName])).sort((left, right) =>
            left.localeCompare(right)
          )
        );
        updateExclusiveOffer({
          exclusive_track_art_path: payload.publicUrl ?? ""
        });
        setArtUploadFile(null);
        setArtUploadState("saved");
        setMessage("Artwork uploaded. Save Site Settings to publish the selection.");
      }
    } catch (error) {
      assetType === "track" ? setTrackUploadState("error") : setArtUploadState("error");
      setMessage(error instanceof Error ? error.message : "Unable to upload the file.");
    }
  }

  return (
    <>
      {/* SECTION 9: EXCLUSIVE TRACK OFFER */}
      <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Section 9</p>
            <h3 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
              <Sparkles size={20} />
              Early Access Preview Offer
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Control the public `/exclusives` capture page, preview track, artwork,
              success copy, and availability from Public Site management.
            </p>
          </div>
          <span className="pill">Saved with Site Settings</span>
        </div>

        <div className="mt-5 grid gap-3 rounded-[22px] border border-[#30343b] bg-[#0f1217] p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="field-label">Current Mode</p>
            <p className="mt-2 font-semibold text-ink">{offerPreview.modeLabel}</p>
          </div>
          <div>
            <p className="field-label">Visitor Receives</p>
            <p className="mt-2 font-semibold text-ink">{offerPreview.visitorReceives}</p>
          </div>
          <div>
            <p className="field-label">Readiness</p>
            <p
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                offerPreview.readinessTone === "ready"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : offerPreview.readinessTone === "warning"
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    : "border-[#30343b] bg-[#15181c] text-muted"
              }`}
            >
              {offerPreview.readiness}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="field-label">Badge Text</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({badge_text: event.target.value})}
              value={exclusiveOffer.badge_text}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">CTA Button</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({cta_label: event.target.value})}
              value={exclusiveOffer.cta_label}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Headline</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({headline: event.target.value})}
              value={exclusiveOffer.headline}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Subtext</span>
            <textarea
              className="field-input min-h-[110px]"
              onChange={(event) => updateExclusiveOffer({subtext: event.target.value})}
              value={exclusiveOffer.subtext}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Brand Line</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({brand_line: event.target.value})}
              value={exclusiveOffer.brand_line}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Name Field Label</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({name_label: event.target.value})}
              value={exclusiveOffer.name_label}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Email Field Label</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({email_label: event.target.value})}
              value={exclusiveOffer.email_label}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Consent Label</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({consent_label: event.target.value})}
              value={exclusiveOffer.consent_label}
            />
          </label>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="field-label">Preview Title</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({exclusive_track_title: event.target.value})
              }
              value={exclusiveOffer.exclusive_track_title}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Download Label</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({download_label: event.target.value})}
              value={exclusiveOffer.download_label}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Preview Description</span>
            <textarea
              className="field-input min-h-[110px]"
              onChange={(event) =>
                updateExclusiveOffer({exclusive_track_description: event.target.value})
              }
              value={exclusiveOffer.exclusive_track_description}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Success Heading</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({success_heading: event.target.value})}
              value={exclusiveOffer.success_heading}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Duplicate Success Message</span>
            <textarea
              className="field-input min-h-[110px]"
              onChange={(event) => updateExclusiveOffer({duplicate_message: event.target.value})}
              value={exclusiveOffer.duplicate_message}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Success Message</span>
            <textarea
              className="field-input min-h-[110px]"
              onChange={(event) => updateExclusiveOffer({success_message: event.target.value})}
              value={exclusiveOffer.success_message}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Unavailable Heading</span>
            <input
              className="field-input"
              onChange={(event) => updateExclusiveOffer({unavailable_heading: event.target.value})}
              value={exclusiveOffer.unavailable_heading}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Enabled</span>
            <button
              className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition ${
                exclusiveOffer.exclusive_track_enabled
                  ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                  : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
              }`}
              onClick={() =>
                updateExclusiveOffer({
                  exclusive_track_enabled: !exclusiveOffer.exclusive_track_enabled
                })
              }
              type="button"
            >
              <span>
                {exclusiveOffer.exclusive_track_enabled
                  ? exclusiveOffer.unlock_experience === "signup_notify"
                    ? "The preview page is live in Notify Me mode."
                    : "The preview page is live if a preview asset/URL and Preview Title are present."
                  : "The preview page will show an unavailable state."}
              </span>
              <span className="pill">
                {exclusiveOffer.exclusive_track_enabled ? "Enabled" : "Disabled"}
              </span>
            </button>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Unavailable Body</span>
            <textarea
              className="field-input min-h-[110px]"
              onChange={(event) => updateExclusiveOffer({unavailable_body: event.target.value})}
              value={exclusiveOffer.unavailable_body}
            />
          </label>
        </div>

        {/* DELIVERY & EXPERIENCE SUB-SECTION */}
        <div className="mt-8 rounded-[24px] border border-[#30343b] bg-[#0f1217] p-4 sm:p-5">
          <div>
            <p className="field-label">Delivery & Experience</p>
            <h4 className="mt-2 text-xl font-semibold text-ink">
              Unlock Mode & Email Settings
            </h4>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <span className="field-label">Unlock Experience</span>
              <div className="flex gap-2">
                {["instant_unlock", "email_only", "signup_notify"].map((mode) => (
                  <button
                    key={mode}
                    className={`flex-1 rounded-[18px] border px-4 py-3 text-center transition capitalize ${
                      exclusiveOffer.unlock_experience === mode
                        ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                        : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962]"
                    }`}
                    onClick={() => updateExclusiveOffer({unlock_experience: mode as any})}
                    type="button"
                  >
                    {mode.replace("_", " ")}
                  </button>
                ))}
              </div>
              {exclusiveOffer.unlock_experience === "signup_notify" ? (
                <p className="mt-3 text-xs text-[#a1a7b0]">
                  Collect subscribers before choosing a lead magnet. No track file or private link required.
                </p>
              ) : null}
            </div>

            {exclusiveOffer.unlock_experience !== "signup_notify" ? (
              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Private External URL</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateExclusiveOffer({private_external_url: event.target.value})
                  }
                  placeholder="https://..."
                  value={exclusiveOffer.private_external_url}
                />
                <p className="text-xs text-muted">
                  Use an unlisted YouTube, SoundCloud, or Dropbox link. If left blank, it falls back to the uploaded Preview Asset.
                </p>
              </label>
            ) : null}

            {exclusiveOffer.unlock_experience === "instant_unlock" ? (
              <label className="space-y-2">
                <span className="field-label">Instant Unlock Button Label</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateExclusiveOffer({instant_unlock_button_label: event.target.value})
                  }
                  value={exclusiveOffer.instant_unlock_button_label}
                />
              </label>
            ) : null}

            {exclusiveOffer.unlock_experience === "instant_unlock" ? (
              <label className="flex items-center gap-3 space-y-0 rounded-[18px] border border-[#30343b] bg-[#15181c] px-4 py-3">
                <input
                  checked={exclusiveOffer.also_email_link}
                  className="h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347]"
                  onChange={(event) =>
                    updateExclusiveOffer({also_email_link: event.target.checked})
                  }
                  type="checkbox"
                />
                <span className="text-sm font-medium text-[#d5d9df]">
                  Also send link by email
                </span>
              </label>
            ) : null}

            {(exclusiveOffer.unlock_experience === "email_only" ||
              (exclusiveOffer.unlock_experience === "instant_unlock" &&
                exclusiveOffer.also_email_link)) ? (
              <>
                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Email Subject</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      updateExclusiveOffer({email_subject: event.target.value})
                    }
                    value={exclusiveOffer.email_subject}
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Email Body</span>
                  <textarea
                    className="field-input min-h-[110px]"
                    onChange={(event) =>
                      updateExclusiveOffer({email_body: event.target.value})
                    }
                    value={exclusiveOffer.email_body}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>

        {/* ASSET UPLOAD SUB-SECTION */}
        {exclusiveOffer.unlock_experience !== "signup_notify" ? (
          <div className="mt-8 grid gap-5 xl:grid-cols-2">
            <div className="rounded-[24px] border border-[#30343b] bg-[#0f1217] p-4 sm:p-5">
              <p className="field-label">Preview Asset</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="field-label">Select Existing Preview</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      updateExclusiveOffer({exclusive_track_file_path: event.target.value})
                    }
                    value={exclusiveOffer.exclusive_track_file_path}
                  >
                    <option value="">No track selected</option>
                    {trackFileOptions.map((fileName) => (
                      <option key={fileName} value={fileName}>
                        {fileName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Upload New Preview</span>
                  <input
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                    className="field-input file:mr-3 file:rounded-full file:border-0 file:bg-[#c9a347] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#13161a]"
                    onChange={(event) => setTrackUploadFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>

                <button
                  className="action-button-secondary"
                  disabled={!trackUploadFile || trackUploadState === "uploading"}
                  onClick={() => void handleUploadAsset("track")}
                  type="button"
                >
                  <UploadCloud size={16} />
                  {trackUploadState === "uploading" ? "Uploading..." : "Upload Preview"}
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#30343b] bg-[#0f1217] p-4 sm:p-5">
              <p className="field-label">Artwork</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="field-label">Select Existing Artwork</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      updateExclusiveOffer({exclusive_track_art_path: event.target.value})
                    }
                    value={exclusiveOffer.exclusive_track_art_path}
                  >
                    <option value="">No artwork selected</option>
                    {trackArtOptions.map((fileName) => (
                      <option key={fileName} value={toExclusiveArtUrl(fileName)}>
                        {fileName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Upload New Artwork</span>
                  <input
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="field-input file:mr-3 file:rounded-full file:border-0 file:bg-[#c9a347] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#13161a]"
                    onChange={(event) => setArtUploadFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>

                <button
                  className="action-button-secondary"
                  disabled={!artUploadFile || artUploadState === "uploading"}
                  onClick={() => void handleUploadAsset("art")}
                  type="button"
                >
                  <UploadCloud size={16} />
                  {artUploadState === "uploading" ? "Uploading..." : "Upload Artwork"}
                </button>

                {exclusiveOffer.exclusive_track_art_path ? (
                  <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4">
                    <p className="field-label">Current Art Preview</p>
                    <div className="relative mt-3 aspect-square w-full overflow-hidden rounded-[18px]">
                      <Image
                        alt="Exclusive track artwork preview"
                        className="object-cover"
                        fill
                        sizes="320px"
                        src={exclusiveOffer.exclusive_track_art_path}
                        unoptimized
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {message ? (
          <div
            className={`mt-6 rounded-[22px] px-4 py-3 text-sm ${
              trackUploadState === "error" || artUploadState === "error"
                ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                : "border border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
            }`}
          >
            {message}
          </div>
        ) : null}
      </section>

      {/* SECTION 10: COMMUNITY SECTION */}
      <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
        <div>
          <p className="field-label">Section 10</p>
          <h3 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
            Community Section
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            These fields control the community section that appears under the
            preview signup area on `/exclusives`.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Discord Invite URL</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({discord_invite_url: event.target.value})
              }
              placeholder="https://discord.gg/..."
              value={exclusiveOffer.discord_invite_url}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Community Badge Text</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_badge_text: event.target.value})
              }
              value={exclusiveOffer.community_badge_text}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Community Headline</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_headline: event.target.value})
              }
              value={exclusiveOffer.community_headline}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Community Subheadline</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_subheadline: event.target.value})
              }
              value={exclusiveOffer.community_subheadline}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Community Microcopy</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_microcopy: event.target.value})
              }
              value={exclusiveOffer.community_microcopy}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">CTA Block Heading</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_cta_heading: event.target.value})
              }
              value={exclusiveOffer.community_cta_heading}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Community CTA Label</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_cta_label: event.target.value})
              }
              value={exclusiveOffer.community_cta_label}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">CTA Helper Text</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({community_cta_helper: event.target.value})
              }
              value={exclusiveOffer.community_cta_helper}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {exclusiveOffer.community_benefits.map((benefit, index) => (
            <div
              className="rounded-[22px] border border-[#30343b] bg-[#121418] p-4"
              key={benefit.id || index}
            >
              <p className="field-label">Benefit {index + 1}</p>
              <label className="mt-3 block space-y-2">
                <span className="field-label">Title</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateCommunityBenefit(index, {title: event.target.value})
                  }
                  value={benefit.title}
                />
              </label>
              <label className="mt-3 block space-y-2">
                <span className="field-label">Description</span>
                <textarea
                  className="field-input min-h-[96px]"
                  onChange={(event) =>
                    updateCommunityBenefit(index, {description: event.target.value})
                  }
                  value={benefit.description}
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
