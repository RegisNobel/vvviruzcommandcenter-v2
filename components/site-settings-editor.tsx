"use client";

import {Save, Settings2} from "lucide-react";
import {useMemo, useState} from "react";

import type {
  BrandPillar,
  ReleaseSummary,
  SiteSettingsRecord,
  SocialLink
} from "@/lib/types";
import {createId} from "@/lib/utils";

import {ExclusiveOfferSettingsPanel} from "@/components/exclusive-offer-settings-panel";

type SaveState = "idle" | "saving" | "saved" | "error";

type SiteSettingsEditorProps = {
  exclusiveTrackArtOptions: string[];
  exclusiveTrackFileOptions: string[];
  initialSiteSettings: SiteSettingsRecord;
  releaseOptions: ReleaseSummary[];
  siteIconOptions: string[];
};

function serializeLinkRows(items: Array<{label: string; url: string}>) {
  return items.map((item) => `${item.label} | ${item.url}`).join("\n");
}

function parseLinkRows<T extends SocialLink>(value: string): T[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelPart, ...urlParts] = line.split("|");
      const label = labelPart?.trim() || "Untitled";
      const url = urlParts.join("|").trim();

      return {
        id: createId(),
        label,
        url
      } as T;
    });
}

export function SiteSettingsEditor({
  exclusiveTrackArtOptions,
  exclusiveTrackFileOptions,
  initialSiteSettings,
  releaseOptions,
  siteIconOptions
}: SiteSettingsEditorProps) {
  const [settings, setSettings] = useState(initialSiteSettings);
  const [socialLinksText, setSocialLinksText] = useState(
    serializeLinkRows(initialSiteSettings.social_links)
  );
  const [featuredReleaseQuery, setFeaturedReleaseQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (saveState === "saving") {
      return "Saving...";
    }

    if (saveState === "saved") {
      return "Saved";
    }

    if (saveState === "error") {
      return "Save error";
    }

    return "Manual save";
  }, [saveState]);

  const selectedFeaturedReleases = useMemo(
    () =>
      settings.site_content.home.featured_release_ids
        .map((releaseId) => releaseOptions.find((release) => release.id === releaseId))
        .filter((release): release is ReleaseSummary => Boolean(release)),
    [releaseOptions, settings.site_content.home.featured_release_ids]
  );

  const filteredReleaseOptions = useMemo(() => {
    const selectedIds = new Set(settings.site_content.home.featured_release_ids);
    const query = featuredReleaseQuery.trim().toLowerCase();

    return releaseOptions
      .filter((release) => {
        if (selectedIds.has(release.id)) {
          return false;
        }

        if (!query) {
          return true;
        }

        return release.title.toLowerCase().includes(query);
      })
      .slice(0, 12);
  }, [featuredReleaseQuery, releaseOptions, settings.site_content.home.featured_release_ids]);

  function updateSiteContent<
    TSection extends keyof SiteSettingsRecord["site_content"],
    TKey extends keyof SiteSettingsRecord["site_content"][TSection]
  >(section: TSection, key: TKey, value: SiteSettingsRecord["site_content"][TSection][TKey]) {
    setSettings((current) => ({
      ...current,
      site_content: {
        ...current.site_content,
        [section]: {
          ...current.site_content[section],
          [key]: value
        }
      }
    }));
  }

  function updateBrandPillar(
    pillarIndex: number,
    patch: Partial<BrandPillar>
  ) {
    setSettings((current) => ({
      ...current,
      site_content: {
        ...current.site_content,
        home: {
          ...current.site_content.home,
          brand_pillars: current.site_content.home.brand_pillars.map((pillar, index) =>
            index === pillarIndex ? {...pillar, ...patch} : pillar
          )
        }
      }
    }));
  }

  function toggleFeaturedRelease(releaseId: string) {
    const selectedIds = settings.site_content.home.featured_release_ids;

    if (selectedIds.includes(releaseId)) {
      setSettings((current) => ({
        ...current,
        site_content: {
          ...current.site_content,
          home: {
            ...current.site_content.home,
            featured_release_ids: current.site_content.home.featured_release_ids.filter(
              (value) => value !== releaseId
            )
          }
        }
      }));

      return;
    }

    if (selectedIds.length >= 3) {
      setMessage("You can feature up to 3 releases on the homepage.");
      setSaveState("idle");

      return;
    }

    setSettings((current) => {
      return {
        ...current,
        site_content: {
          ...current.site_content,
          home: {
            ...current.site_content.home,
            featured_release_ids: [...current.site_content.home.featured_release_ids, releaseId]
          }
        }
      };
    });
  }

  async function handleSave() {
    setSaveState("saving");
    setMessage(null);

    const exclusiveSettings = settings.site_content.exclusive;
    if (exclusiveSettings.unlock_experience === "email_only" || exclusiveSettings.also_email_link) {
      if (!exclusiveSettings.email_subject?.trim() || !exclusiveSettings.email_body?.trim()) {
        setSaveState("error");
        setMessage("Email Subject and Email Body are required for Exclusive Email delivery.");
        return;
      }
    }

    const payload: SiteSettingsRecord = {
      ...settings,
      social_links: parseLinkRows<SocialLink>(socialLinksText)
    };

    try {
      const response = await fetch("/api/site-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as {
        message?: string;
        siteSettings?: SiteSettingsRecord;
      };

      if (!response.ok || !data.siteSettings) {
        throw new Error(data.message ?? "Save failed.");
      }

      setSettings(data.siteSettings);
      setSocialLinksText(serializeLinkRows(data.siteSettings.social_links));
      setSaveState("saved");
      setMessage("Public site settings saved.");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Save failed unexpectedly.");
    }
  }

  return (
    <section className="panel space-y-6 px-6 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="pill">
            <Settings2 size={12} />
            Public site settings
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Public profile and website copy
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Everything on the public site that is not release-specific lives here.
            Releases still own release content, but all global site copy, labels,
            headings, pills, and fallback text are editable from this page.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="pill">{statusLabel}</span>
          <button className="action-button-primary" onClick={handleSave} type="button">
            <Save size={16} />
            Save Site Settings
          </button>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 1</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Core Profile</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Artist Name</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    artist_name: event.target.value
                  }))
                }
                value={settings.artist_name}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Tagline</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    tagline: event.target.value
                  }))
                }
                value={settings.tagline}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Contact Email</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    contact_email: event.target.value
                  }))
                }
                type="email"
                value={settings.contact_email}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 2</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Metadata & SEO</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Site Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("metadata", "site_title", event.target.value)
                }
                value={settings.site_content.metadata.site_title}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Site Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent("metadata", "site_description", event.target.value)
                }
                value={settings.site_content.metadata.site_description}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Music Page Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("metadata", "music_page_title", event.target.value)
                }
                value={settings.site_content.metadata.music_page_title}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">About Page Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("metadata", "about_page_title", event.target.value)
                }
                value={settings.site_content.metadata.about_page_title}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Links Page Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("metadata", "links_page_title", event.target.value)
                }
                value={settings.site_content.metadata.links_page_title}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Missing Release Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "metadata",
                    "release_not_found_title",
                    event.target.value
                  )
                }
                value={settings.site_content.metadata.release_not_found_title}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Exclusives Page Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("metadata", "exclusive_page_title", event.target.value)
                }
                value={settings.site_content.metadata.exclusive_page_title}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Music Page Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent(
                    "metadata",
                    "music_page_description",
                    event.target.value
                  )
                }
                value={settings.site_content.metadata.music_page_description}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">About Page Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent(
                    "metadata",
                    "about_page_description",
                    event.target.value
                  )
                }
                value={settings.site_content.metadata.about_page_description}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Links Page Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent(
                    "metadata",
                    "links_page_description",
                    event.target.value
                  )
                }
                value={settings.site_content.metadata.links_page_description}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Missing Release Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent(
                    "metadata",
                    "release_not_found_description",
                    event.target.value
                  )
                }
                value={settings.site_content.metadata.release_not_found_description}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Exclusives Page Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent(
                    "metadata",
                    "exclusive_page_description",
                    event.target.value
                  )
                }
                value={settings.site_content.metadata.exclusive_page_description}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 3</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Chrome</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Brand Mark Alt Text</span>
              <input
                className="field-input"
                  onChange={(event) =>
                    updateSiteContent("chrome", "brand_mark_text", event.target.value)
                  }
                  value={settings.site_content.chrome.brand_mark_text}
                />
              </label>

            <label className="space-y-2">
              <span className="field-label">Header Image</span>
              <select
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "brand_mark_file", event.target.value)
                }
                value={settings.site_content.chrome.brand_mark_file}
              >
                {siteIconOptions.map((fileName) => (
                  <option key={fileName} value={fileName}>
                    {fileName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Brand Subtitle</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "brand_subtitle_text", event.target.value)
                }
                value={settings.site_content.chrome.brand_subtitle_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Nav Home Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "nav_home_label", event.target.value)
                }
                value={settings.site_content.chrome.nav_home_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Nav Music Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "nav_music_label", event.target.value)
                }
                value={settings.site_content.chrome.nav_music_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Nav About Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "nav_about_label", event.target.value)
                }
                value={settings.site_content.chrome.nav_about_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Nav Links Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "nav_links_label", event.target.value)
                }
                value={settings.site_content.chrome.nav_links_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Nav Exclusive Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("chrome", "nav_exclusive_label", event.target.value)
                }
                value={settings.site_content.chrome.nav_exclusive_label}
              />
            </label>

              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Footer Copyright Line</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateSiteContent(
                      "chrome",
                      "footer_copyright_text",
                      event.target.value
                    )
                  }
                  value={settings.site_content.chrome.footer_copyright_text}
                />
              </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 4</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Home Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Hero Badge</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("home", "hero_badge_text", event.target.value)
                }
                value={settings.site_content.home.hero_badge_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Featured Eyebrow</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "home",
                    "featured_releases_eyebrow",
                    event.target.value
                  )
                }
                value={settings.site_content.home.featured_releases_eyebrow}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Secondary CTA Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("home", "secondary_cta_label", event.target.value)
                }
                value={settings.site_content.home.secondary_cta_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Exclusive CTA Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("home", "exclusive_cta_label", event.target.value)
                }
                value={settings.site_content.home.exclusive_cta_label}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Featured Empty State</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent(
                    "home",
                    "featured_releases_empty_text",
                    event.target.value
                  )
                }
                value={settings.site_content.home.featured_releases_empty_text}
              />
            </label>

            <div className="space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="field-label">Featured Releases</span>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Pick up to 3 releases for the hero area. If none are selected, the
                    homepage falls back to the current featured public release.
                  </p>
                </div>
                <span className="pill">
                  {settings.site_content.home.featured_release_ids.length}/3 selected
                </span>
              </div>

              {selectedFeaturedReleases.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {selectedFeaturedReleases.map((release) => (
                    <button
                      className="rounded-[20px] border border-[#c9a347]/25 bg-[#171a1f] px-4 py-4 text-left transition hover:border-[#c9a347]/45 hover:bg-[#1b1f25]"
                      key={release.id}
                      onClick={() => toggleFeaturedRelease(release.id)}
                      type="button"
                    >
                      <p className="text-sm font-semibold text-ink">{release.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {release.type} • {release.status}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-[#d5b15b]">
                        Remove
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="field-label">Find Releases</span>
                <input
                  className="field-input"
                  onChange={(event) => setFeaturedReleaseQuery(event.target.value)}
                  placeholder="Search by release title"
                  value={featuredReleaseQuery}
                />
              </label>

              <div className="max-h-72 space-y-2 overflow-y-auto rounded-[22px] border border-[#30343b] bg-[#0f1217] p-3">
                {filteredReleaseOptions.length > 0 ? (
                  filteredReleaseOptions.map((release) => (
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition hover:border-[#c9a347]/35 hover:bg-[#171b20]"
                      key={release.id}
                      onClick={() => toggleFeaturedRelease(release.id)}
                      type="button"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{release.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {release.type} • {release.status}
                        </p>
                      </div>
                      <span className="pill">Add</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-3 text-sm text-slate-500">
                    No releases match this search.
                  </p>
                )}
              </div>
            </div>

            <label className="space-y-2">
              <span className="field-label">Recent Releases Eyebrow</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "home",
                    "recent_releases_eyebrow",
                    event.target.value
                  )
                }
                value={settings.site_content.home.recent_releases_eyebrow}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Recent Releases Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "home",
                    "recent_releases_heading",
                    event.target.value
                  )
                }
                value={settings.site_content.home.recent_releases_heading}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Recent Releases CTA</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "home",
                    "recent_releases_view_all_label",
                    event.target.value
                  )
                }
                value={settings.site_content.home.recent_releases_view_all_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Brand Pillars Eyebrow</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("home", "brand_pillars_eyebrow", event.target.value)
                }
                value={settings.site_content.home.brand_pillars_eyebrow}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Brand Pillars Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("home", "brand_pillars_heading", event.target.value)
                }
                value={settings.site_content.home.brand_pillars_heading}
              />
            </label>

            <div className="space-y-3 md:col-span-2">
              <div>
                <span className="field-label">Brand Pillar Cards</span>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Update the carousel copy and image for each pillar. Add more files to
                  `storage/site_icons` if you want extra image options here.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {settings.site_content.home.brand_pillars.map((pillar, index) => (
                  <div
                    className="rounded-[22px] border border-[#30343b] bg-[#0f1217] p-4"
                    key={pillar.id}
                  >
                    <p className="field-label">Pillar {index + 1}</p>

                    <div className="mt-4 space-y-4">
                      <label className="space-y-2">
                        <span className="field-label">Title</span>
                        <input
                          className="field-input"
                          onChange={(event) =>
                            updateBrandPillar(index, {title: event.target.value})
                          }
                          value={pillar.title}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="field-label">Description</span>
                        <textarea
                          className="field-input min-h-[120px]"
                          onChange={(event) =>
                            updateBrandPillar(index, {description: event.target.value})
                          }
                          value={pillar.description}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="field-label">Carousel Image</span>
                        <select
                          className="field-input"
                          onChange={(event) =>
                            updateBrandPillar(index, {imageFile: event.target.value})
                          }
                          value={pillar.imageFile}
                        >
                          {siteIconOptions.map((fileName) => (
                            <option key={fileName} value={fileName}>
                              {fileName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 5</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Music Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Page Eyebrow</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("music", "page_eyebrow", event.target.value)
                }
                value={settings.site_content.music.page_eyebrow}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Page Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("music", "page_heading", event.target.value)
                }
                value={settings.site_content.music.page_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Page Description</span>
              <textarea
                className="field-input min-h-[120px]"
                onChange={(event) =>
                  updateSiteContent("music", "page_description", event.target.value)
                }
                value={settings.site_content.music.page_description}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">All Releases Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("music", "all_releases_label", event.target.value)
                }
                value={settings.site_content.music.all_releases_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Nerdcore Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("music", "nerdcore_label", event.target.value)
                }
                value={settings.site_content.music.nerdcore_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Mainstream Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("music", "mainstream_label", event.target.value)
                }
                value={settings.site_content.music.mainstream_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Empty State</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("music", "empty_state_text", event.target.value)
                }
                value={settings.site_content.music.empty_state_text}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 6</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">About Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Statement Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "statement_heading", event.target.value)
                }
                value={settings.site_content.about.statement_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Statement Text</span>
              <textarea
                className="field-input min-h-[120px]"
                onChange={(event) =>
                  updateSiteContent("about", "statement_text", event.target.value)
                }
                value={settings.site_content.about.statement_text}
              />
              <p className="text-xs leading-5 text-slate-500">
                Line breaks are preserved on the public About page.
              </p>
            </label>

            <label className="space-y-2">
              <span className="field-label">About Image</span>
              <select
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "artist_image_file", event.target.value)
                }
                value={settings.site_content.about.artist_image_file}
              >
                {siteIconOptions.map((fileName) => (
                  <option key={fileName} value={fileName}>
                    {fileName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Narrative Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "narrative_heading", event.target.value)
                }
                value={settings.site_content.about.narrative_heading}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Intro Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "intro_heading", event.target.value)
                }
                value={settings.site_content.about.intro_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Intro Text</span>
              <textarea
                className="field-input min-h-[120px]"
                onChange={(event) =>
                  updateSiteContent("about", "intro_text", event.target.value)
                }
                value={settings.site_content.about.intro_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Philosophy Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "philosophy_heading", event.target.value)
                }
                value={settings.site_content.about.philosophy_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Philosophy Text</span>
              <textarea
                className="field-input min-h-[120px]"
                onChange={(event) =>
                  updateSiteContent("about", "philosophy_text", event.target.value)
                }
                value={settings.site_content.about.philosophy_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Closing Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "closing_heading", event.target.value)
                }
                value={settings.site_content.about.closing_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Closing Line Text</span>
              <textarea
                className="field-input min-h-[120px]"
                onChange={(event) =>
                  updateSiteContent("about", "closing_text", event.target.value)
                }
                value={settings.site_content.about.closing_text}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Connect Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "connect_heading", event.target.value)
                }
                value={settings.site_content.about.connect_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Contact Microcopy</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "contact_microcopy", event.target.value)
                }
                value={settings.site_content.about.contact_microcopy}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Empty Connect Text</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "connect_empty_text", event.target.value)
                }
                value={settings.site_content.about.connect_empty_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Empty Contact Text</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("about", "contact_empty_text", event.target.value)
                }
                value={settings.site_content.about.contact_empty_text}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 7</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Platform Labels</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Spotify Chip Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("platforms", "spotify_label", event.target.value)
                }
                value={settings.site_content.platforms.spotify_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Apple Music Chip Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("platforms", "apple_music_label", event.target.value)
                }
                value={settings.site_content.platforms.apple_music_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">YouTube Chip Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("platforms", "youtube_label", event.target.value)
                }
                value={settings.site_content.platforms.youtube_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Links Page Spotify CTA</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "platforms",
                    "listen_on_spotify_label",
                    event.target.value
                  )
                }
                value={settings.site_content.platforms.listen_on_spotify_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Links Page Apple Music CTA</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "platforms",
                    "listen_on_apple_music_label",
                    event.target.value
                  )
                }
                value={settings.site_content.platforms.listen_on_apple_music_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Links Page YouTube Music CTA</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "platforms",
                    "listen_on_youtube_music_label",
                    event.target.value
                  )
                }
                value={settings.site_content.platforms.listen_on_youtube_music_label}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Links Page YouTube Video CTA</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "platforms",
                    "watch_on_youtube_label",
                    event.target.value
                  )
                }
                value={settings.site_content.platforms.watch_on_youtube_label}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 8</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Links Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Badge Text</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("links", "badge_text", event.target.value)
                }
                value={settings.site_content.links.badge_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Campaign Release</span>
              <select
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("links", "selected_release_id", event.target.value)
                }
                value={settings.site_content.links.selected_release_id}
              >
                <option value="">Auto-select featured/latest published release</option>
                {releaseOptions.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Empty State Text</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("links", "empty_state_text", event.target.value)
                }
                value={settings.site_content.links.empty_state_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Exclusive CTA Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("links", "exclusive_cta_label", event.target.value)
                }
                value={settings.site_content.links.exclusive_cta_label}
              />
            </label>
          </div>
        </section>

        <ExclusiveOfferSettingsPanel
          exclusiveOffer={settings.site_content.exclusive}
          initialTrackArtOptions={exclusiveTrackArtOptions}
          initialTrackFileOptions={exclusiveTrackFileOptions}
          onChange={(exclusive) =>
            setSettings((current) => ({
              ...current,
              site_content: {
                ...current.site_content,
                exclusive
              }
            }))
          }
        />

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 10</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Tracking</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Enable Meta Pixel</span>
              <button
                className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition ${
                  settings.site_content.analytics.meta_pixel_enabled
                    ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                    : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
                }`}
                onClick={() =>
                  updateSiteContent(
                    "analytics",
                    "meta_pixel_enabled",
                    !settings.site_content.analytics.meta_pixel_enabled
                  )
                }
                type="button"
              >
                <span>
                  {settings.site_content.analytics.meta_pixel_enabled
                    ? "Meta Pixel will render on the public site."
                    : "Meta Pixel stays disabled until you are ready to install it."}
                </span>
                <span className="pill">
                  {settings.site_content.analytics.meta_pixel_enabled ? "Enabled" : "Disabled"}
                </span>
              </button>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Meta Pixel ID</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("analytics", "meta_pixel_id", event.target.value)
                }
                placeholder="123456789012345"
                value={settings.site_content.analytics.meta_pixel_id}
              />
              <p className="text-xs leading-5 text-slate-500">
                This is the public-site foundation only. Once a real Pixel ID is added
                and enabled, the base Meta Pixel script will load on public routes.
              </p>
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 11</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Release Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Back to Music Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("release", "back_to_music_label", event.target.value)
                }
                value={settings.site_content.release.back_to_music_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Lyrics Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("release", "lyrics_heading", event.target.value)
                }
                value={settings.site_content.release.lyrics_heading}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Spotify Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("release", "spotify_heading", event.target.value)
                }
                value={settings.site_content.release.spotify_heading}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Video Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("release", "video_heading", event.target.value)
                }
                value={settings.site_content.release.video_heading}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Related Eyebrow</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "release",
                    "related_releases_eyebrow",
                    event.target.value
                  )
                }
                value={settings.site_content.release.related_releases_eyebrow}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Related Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "release",
                    "related_releases_heading",
                    event.target.value
                  )
                }
                value={settings.site_content.release.related_releases_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Related View-All Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent(
                    "release",
                    "related_releases_view_all_label",
                    event.target.value
                  )
                }
                value={settings.site_content.release.related_releases_view_all_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Not-Found Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  updateSiteContent("release", "not_found_heading", event.target.value)
                }
                value={settings.site_content.release.not_found_heading}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Not-Found Body</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  updateSiteContent("release", "not_found_body", event.target.value)
                }
                value={settings.site_content.release.not_found_body}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
          <div>
            <p className="field-label">Section 12</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Social Links</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Social Links</span>
              <textarea
                className="field-input min-h-[140px]"
                onChange={(event) => setSocialLinksText(event.target.value)}
                placeholder={"One per line: Label | URL"}
                value={socialLinksText}
              />
              <p className="text-xs leading-5 text-slate-500">
                Use one link per line in the format `Label | URL`. Empty lines are ignored.
              </p>
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Public site control map</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">
              Copy, images, links, and tracking are admin-editable
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Use this page to update the public header, nav labels, homepage hero,
              featured releases, carousel images, About copy/image, social links,
              link-page campaign release, exclusive track offer, CTA labels, SEO text,
              and Meta Pixel setup without changing code.
            </p>
          </div>
          <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d7b45e] sm:grid-cols-2">
            <span className="pill">Copy</span>
            <span className="pill">Images</span>
            <span className="pill">Links</span>
            <span className="pill">Tracking</span>
          </div>
        </div>
      </section>
      {message ? (
        <div
          className={`rounded-[22px] px-4 py-3 text-sm ${
            saveState === "error"
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
