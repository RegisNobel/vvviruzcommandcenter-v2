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
    <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="field-label">Section 9</p>
          <h3 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
            <Sparkles size={20} />
            Exclusive Track Offer
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Control the public `/exclusives` capture page, gated track, artwork,
            success copy, and availability from Public Site management.
          </p>
        </div>
        <span className="pill">Saved with Site Settings</span>
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

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="field-label">Track Title</span>
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
          <span className="field-label">Track Description</span>
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
                ? "The exclusive page is live if the track file is present."
                : "The exclusive page will show an unavailable state."}
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

      <section className="mt-5 rounded-[24px] border border-[#30343b] bg-[#0f1217] p-4 sm:p-5">
        <div>
          <p className="field-label">Community Section</p>
          <h4 className="mt-2 text-xl font-semibold text-ink">
            vvviruz command center promo
          </h4>
          <p className="mt-2 text-sm leading-6 text-muted">
            These fields control the community section that appears under the
            exclusive-track signup area on `/exclusives`.
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

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[24px] border border-[#30343b] bg-[#0f1217] p-4 sm:p-5">
          <p className="field-label">Track Asset</p>
          <div className="mt-4 space-y-4">
            <label className="space-y-2">
              <span className="field-label">Select Existing Track</span>
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
              <span className="field-label">Upload New Track</span>
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
              {trackUploadState === "uploading" ? "Uploading..." : "Upload Track"}
            </button>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#0f1217] p-4 sm:p-5">
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
        </section>
      </div>

      {message ? (
        <div
          className={`mt-5 rounded-[22px] px-4 py-3 text-sm ${
            trackUploadState === "error" || artUploadState === "error"
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
