"use client";

import {Sparkles} from "lucide-react";
import {useState} from "react";

import type {SiteSettingsRecord, ReleaseSummary} from "@/lib/types";

type ExclusiveOfferSettings = SiteSettingsRecord["site_content"]["exclusive"];

type ExclusiveOfferSettingsPanelProps = {
  exclusiveOffer: ExclusiveOfferSettings;
  onChange: (exclusiveOffer: ExclusiveOfferSettings) => void;
  releaseOptions?: ReleaseSummary[];
  vaultReleaseIds?: string[];
};

function clientIsReleaseEligibleForPreview(release: ReleaseSummary): boolean {
  if (release.status === "Published") {
    if (release.release_date) {
      const releaseDate = new Date(release.release_date);
      if (!isNaN(releaseDate.getTime()) && releaseDate.getTime() <= Date.now()) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

function getExclusiveOfferPreview(exclusiveOffer: ExclusiveOfferSettings) {
  const hasPrivateUrl = Boolean(exclusiveOffer.private_external_url.trim());
  const hasEmailCopy =
    Boolean(exclusiveOffer.email_subject.trim()) && Boolean(exclusiveOffer.email_body.trim());

  if (!exclusiveOffer.exclusive_track_enabled) {
    return {
      modeLabel: "Insider Access",
      visitorReceives: "Unavailable state",
      readiness: "Disabled",
      readinessTone: "neutral"
    };
  }

  if (!hasPrivateUrl) {
    return {
      modeLabel: "Insider Access",
      visitorReceives: "No active preview configured",
      readiness: "Needs Private External URL",
      readinessTone: "warning"
    };
  }

  if (!hasEmailCopy) {
    return {
      modeLabel: "Insider Access",
      visitorReceives: "Immediate private preview URL link",
      readiness: "Needs email subject/body",
      readinessTone: "warning"
    };
  }

  return {
    modeLabel: "Insider Access",
    visitorReceives: "Immediate private preview URL link",
    readiness: "Ready",
    readinessTone: "ready"
  };
}

export function ExclusiveOfferSettingsPanel({
  exclusiveOffer,
  onChange,
  releaseOptions = [],
  vaultReleaseIds = []
}: ExclusiveOfferSettingsPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isUploadingArt, setIsUploadingArt] = useState(false);

  async function handleArtUpload(file: File) {
    setIsUploadingArt(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (exclusiveOffer.exclusive_track_art_path) {
        formData.append("previousPath", exclusiveOffer.exclusive_track_art_path);
      }

      const response = await fetch("/api/exclusive/art-upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as {
        asset?: { url: string };
        message?: string;
      };

      if (!response.ok || !payload.asset) {
        throw new Error(payload.message ?? "Artwork upload failed.");
      }

      updateExclusiveOffer({
        exclusive_track_art_path: payload.asset.url
      });
      setMessage("Artwork image uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed unexpectedly.");
    } finally {
      setIsUploadingArt(false);
    }
  }

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

  // Filter out Vault releases from dropdown
  const selectableReleases = releaseOptions.filter(
    (release) => !vaultReleaseIds.includes(release.id)
  );

  const selectedRelease = releaseOptions.find((r) => r.id === exclusiveOffer.release_id);
  const showReleaseWarning = selectedRelease ? !clientIsReleaseEligibleForPreview(selectedRelease) : false;

  return (
    <>
      {/* SECTION 9: INSIDER ACCESS OFFER */}
      <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Section 9</p>
            <h3 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
              <Sparkles size={20} />
              Insider Access Offer
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Control the public `/exclusives` capture page, unlisted YouTube watch URL,
              cover artwork, success copy, and availability.
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
            <span className="field-label">Associated Release (Optional)</span>
            <select
              className="field-input"
              value={exclusiveOffer.release_id || ""}
              onChange={(event) =>
                updateExclusiveOffer({release_id: event.target.value || null})
              }
            >
              <option value="">No release associated</option>
              {selectableReleases.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.title} ({release.status})
                </option>
              ))}
            </select>
            {showReleaseWarning && (
              <p className="text-xs text-amber-300 font-semibold mt-1">
                ⚠️ Warning: This release has already been commercially released. Previews are typically for upcoming or unreleased content.
              </p>
            )}
          </label>

          <label className="space-y-2">
            <span className="field-label">Preview Title Override (Optional)</span>
            <input
              className="field-input"
              onChange={(event) =>
                updateExclusiveOffer({exclusive_track_title: event.target.value})
              }
              placeholder={selectedRelease ? `Derived: ${selectedRelease.title}` : "Enter preview title"}
              value={exclusiveOffer.exclusive_track_title}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Preview Description Override (Optional)</span>
            <textarea
              className="field-input min-h-[110px]"
              onChange={(event) =>
                updateExclusiveOffer({exclusive_track_description: event.target.value})
              }
              placeholder="Enter preview description (if empty, defaults to associated release description)"
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
            <span className="field-label">Preview Enabled</span>
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
                  ? "The preview watch button is active for unlocked visitors."
                  : "The preview shows a 'Next preview coming soon' status."}
              </span>
              <span className="pill">
                {exclusiveOffer.exclusive_track_enabled ? "Active" : "Soon"}
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
              Unlisted YouTube Video & Email Settings
            </h4>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="field-label">Private External URL</span>
              <div className="flex gap-2">
                <input
                  className="field-input flex-1"
                  onChange={(event) =>
                    updateExclusiveOffer({private_external_url: event.target.value})
                  }
                  placeholder="https://soundcloud.com/... or https://youtube.com/..."
                  value={exclusiveOffer.private_external_url}
                />
                {exclusiveOffer.private_external_url?.trim() && (
                  <a
                    className="rounded-full border border-[#30343b] bg-[#15181c] px-4 py-3 text-sm font-semibold text-[#d5d9df] hover:border-[#c9a347]/45 hover:bg-[#c9a347]/10"
                    href={exclusiveOffer.private_external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Test Link
                  </a>
                )}
              </div>
              <p className="text-xs text-muted">
                Enter the unlisted YouTube video, SoundCloud, BandLab, or other HTTPS preview link.
              </p>
            </label>

            <label className="block space-y-2">
              <span className="field-label">Preview Cover Image URL Override (Optional)</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateExclusiveOffer({exclusive_track_art_path: event.target.value})
                }
                placeholder={selectedRelease ? "Derived from associated release artwork" : "https://... or /api/assets/..."}
                value={exclusiveOffer.exclusive_track_art_path}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-[#c9a347]/36 bg-[#c9a347] px-4 py-2.5 text-sm font-semibold text-[#13161a] transition hover:scale-[1.01] hover:bg-[#d8b761] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer">
                  {isUploadingArt ? "Uploading artwork..." : "Upload Artwork Image"}
                  <input
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingArt}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleArtUpload(file);
                      }
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
                {exclusiveOffer.exclusive_track_art_path ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-[#c5cdd6] transition hover:scale-[1.01] hover:border-white/15 hover:bg-white/[0.06]"
                    onClick={() => updateExclusiveOffer({exclusive_track_art_path: ""})}
                    type="button"
                  >
                    Remove Cover Image
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-muted">
                Custom artwork image URL. If blank, defaults to the associated release cover artwork.
              </p>
            </label>

            <label className="block space-y-2">
              <span className="field-label">Email Subject</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateExclusiveOffer({email_subject: event.target.value})
                }
                value={exclusiveOffer.email_subject}
              />
            </label>

            <label className="block space-y-2">
              <span className="field-label">Email Body</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateExclusiveOffer({email_body: event.target.value})
                }
                value={exclusiveOffer.email_body}
              />
            </label>
          </div>
        </div>

        {message ? (
          <div className="mt-6 rounded-[22px] border border-[#5b4920] bg-[#1a1710] px-4 py-3 text-sm text-[#d7b45e]">
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
            signup area on `/exclusives`.
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
