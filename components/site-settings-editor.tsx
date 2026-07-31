"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Save,
  Settings2
} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";

import {adminFetch, getAdminErrorMessage} from "@/lib/admin-errors";
import type {
  ReleaseCategoryRecord,
  ReleaseSummary,
  SiteSettingsRecord,
  SocialLink
} from "@/lib/types";
import {HOMEPAGE_PROJECT_LIMIT, moveOrderedItem} from "@/lib/homepage-brand";
import {
  evaluatePublicProjectEligibility,
  getPublicProjectPath
} from "@/lib/public-projects";
import {createId} from "@/lib/utils";

import {ExclusiveOfferSettingsPanel} from "@/components/exclusive-offer-settings-panel";
import {LockInSpotlight} from "@/components/lock-in-spotlight";
import {StickyActionDock} from "@/components/sticky-action-dock";
import {VaultSettingsPanel} from "@/components/vault-settings-panel";
import {CommissionsSettingsPanel} from "@/components/commissions-settings-panel";
import {SiteSettingsSectionNavigation} from "@/components/site-settings-section-navigation";

type SaveState = "idle" | "saving" | "saved" | "error";

type SiteSettingsEditorProps = {
  exclusiveTrackArtOptions: string[];
  exclusiveTrackFileOptions: string[];
  initialSiteSettings: SiteSettingsRecord;
  releaseCategories: ReleaseCategoryRecord[];
  releaseOptions: ReleaseSummary[];
  siteIconOptions: string[];
  vaultReleaseIds?: string[];
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

function getProjectEligibilityMessage(
  reason: ReturnType<typeof evaluatePublicProjectEligibility>["reason"]
) {
  switch (reason) {
    case "missing-slug":
      return "The category needs a valid slug.";
    case "missing-name":
      return "The category needs a public name.";
    case "missing-description":
      return "Add a project description in Music Categories.";
    case "insufficient-public-releases":
      return "At least two published releases are required.";
    case "missing-public-release-slug":
      return "A published release is missing its public URL slug.";
    case "not-allowlisted":
      return "This category is not approved as a public project.";
    default:
      return "Eligible for public project surfaces.";
  }
}

export function SiteSettingsEditor({
  exclusiveTrackArtOptions,
  exclusiveTrackFileOptions,
  initialSiteSettings,
  releaseCategories,
  releaseOptions,
  siteIconOptions,
  vaultReleaseIds
}: SiteSettingsEditorProps) {
  const [settings, setSettings] = useState(initialSiteSettings);
  const [socialLinksText, setSocialLinksText] = useState(
    serializeLinkRows(initialSiteSettings.social_links)
  );
  const [lockInReleaseQuery, setLockInReleaseQuery] = useState("");
  const [projectCandidateSlug, setProjectCandidateSlug] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isCommandDockVisible, setIsCommandDockVisible] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function updateCommandDockVisibility() {
      const header = headerRef.current;

      if (!header) {
        return;
      }

      setIsCommandDockVisible(header.getBoundingClientRect().bottom <= 112);
    }

    updateCommandDockVisibility();
    window.addEventListener("scroll", updateCommandDockVisibility, {passive: true});
    window.addEventListener("resize", updateCommandDockVisibility);

    return () => {
      window.removeEventListener("scroll", updateCommandDockVisibility);
      window.removeEventListener("resize", updateCommandDockVisibility);
    };
  }, []);

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

  const releaseOptionsById = useMemo(
    () => new Map(releaseOptions.map((release) => [release.id, release])),
    [releaseOptions]
  );
  const approvedProjectSlugs = settings.site_content.projects.approved_slugs;
  const approvedProjectSlugSet = useMemo(
    () => new Set(approvedProjectSlugs),
    [approvedProjectSlugs]
  );
  const projectRows = useMemo(
    () =>
      approvedProjectSlugs.map((slug, index) => {
        const category = releaseCategories.find((item) => item.slug === slug);
        const publishedReleases = category
          ? category.release_ids
              .map((releaseId) => releaseOptionsById.get(releaseId))
              .filter(
                (release): release is ReleaseSummary => Boolean(release?.is_published)
              )
          : [];
        const eligibility = evaluatePublicProjectEligibility(
          {
            description: category?.description,
            name: category?.name,
            publicReleaseSlugs: publishedReleases.map((release) => release.slug),
            slug
          },
          approvedProjectSlugSet
        );

        return {
          category,
          eligibility,
          index,
          publishedReleases,
          slug
        };
      }),
    [approvedProjectSlugs, approvedProjectSlugSet, releaseCategories, releaseOptionsById]
  );
  const eligibleProjectSlugs = projectRows
    .filter((row) => row.eligibility.eligible)
    .map((row) => row.slug);
  const availableProjectCategories = releaseCategories.filter(
    (category) => !approvedProjectSlugSet.has(category.slug)
  );
  const spotlightReleaseId = settings.site_content.home.lock_in_spotlight_release_id;
  const explicitlySelectedSpotlightRelease = spotlightReleaseId
    ? releaseOptionsById.get(spotlightReleaseId) ?? null
    : null;
  const validExplicitSpotlightRelease =
    explicitlySelectedSpotlightRelease?.is_published &&
    explicitlySelectedSpotlightRelease.slug.trim()
      ? explicitlySelectedSpotlightRelease
      : null;
  const beastModeFallbackRelease = releaseOptions.find(
    (release) => release.slug === "beast-mode" && release.is_published
  );
  const resolvedSpotlightRelease =
    validExplicitSpotlightRelease ||
    beastModeFallbackRelease ||
    null;
  const filteredLockInReleaseOptions = releaseOptions
    .filter((release) => {
      if (!release.is_published || release.id === spotlightReleaseId) {
        return false;
      }

      const query = lockInReleaseQuery.trim().toLowerCase();
      return !query || release.title.toLowerCase().includes(query);
    })
    .slice(0, 12);
  const missingSpotlightRelease = Boolean(
    spotlightReleaseId && !explicitlySelectedSpotlightRelease
  );
  const spotlightReadinessWarnings = [
    ...(missingSpotlightRelease ? ["The selected spotlight release no longer exists."] : []),
    ...(explicitlySelectedSpotlightRelease && !explicitlySelectedSpotlightRelease.is_published
      ? ["The selected spotlight release is not publicly published, so a fallback will be used."]
      : []),
    ...(explicitlySelectedSpotlightRelease && !explicitlySelectedSpotlightRelease.slug.trim()
      ? ["The selected spotlight release is missing its public URL."]
      : []),
    ...(resolvedSpotlightRelease && !resolvedSpotlightRelease.cover_art_path
      ? ["The spotlight release has no cover art. The public fallback treatment will be used."]
      : []),
    ...(!settings.site_content.home.lock_in_spotlight_headline.trim()
      ? ["Add a public spotlight headline."]
      : []),
    ...(!settings.site_content.home.lock_in_spotlight_cta_label.trim()
      ? ["Add a spotlight CTA label."]
      : [])
  ];
  const aboutPositioningMissingFields = [
    !settings.site_content.about.statement_text.trim() ? "Artist Statement copy" : "",
    !settings.site_content.about.intro_heading.trim() ? "Introduction heading" : "",
    !settings.site_content.about.intro_text.trim() ? "Introduction copy" : ""
  ].filter(Boolean);
  const publicReadinessWarnings = [
    ...(aboutPositioningMissingFields.length > 0
      ? [`About positioning is missing: ${aboutPositioningMissingFields.join(", ")}.`]
      : []),
    ...projectRows
      .filter((row) => !row.eligibility.eligible)
      .map(
        (row) =>
          `${row.category?.name || row.slug}: ${getProjectEligibilityMessage(row.eligibility.reason)}`
      ),
    ...(eligibleProjectSlugs.length === 0 ? ["No projects are currently public."] : [])
  ];

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

  function setLockInSpotlightReleaseId(releaseId: string) {
    updateSiteContent("home", "lock_in_spotlight_release_id", releaseId);
    setLockInReleaseQuery("");
  }

  function addApprovedProject() {
    if (!projectCandidateSlug || approvedProjectSlugSet.has(projectCandidateSlug)) {
      return;
    }

    setSettings((current) => ({
      ...current,
      site_content: {
        ...current.site_content,
        projects: {
          ...current.site_content.projects,
          approved_slugs: [
            ...current.site_content.projects.approved_slugs,
            projectCandidateSlug
          ]
        }
      }
    }));
    setProjectCandidateSlug("");
  }

  function removeApprovedProject(slug: string) {
    const category = releaseCategories.find((item) => item.slug === slug);
    const shouldRemove = window.confirm(
      `Remove ${category?.name || slug} from public projects? The category and release assignments will remain available for legacy music filters.`
    );

    if (!shouldRemove) {
      return;
    }

    setSettings((current) => ({
      ...current,
      site_content: {
        ...current.site_content,
        projects: {
          ...current.site_content.projects,
          approved_slugs: current.site_content.projects.approved_slugs.filter(
            (value) => value !== slug
          )
        }
      }
    }));
  }

  function moveApprovedProject(slug: string, direction: -1 | 1) {
    setSettings((current) => ({
      ...current,
      site_content: {
        ...current.site_content,
        projects: {
          ...current.site_content.projects,
          approved_slugs: moveOrderedItem(
            current.site_content.projects.approved_slugs,
            slug,
            direction
          )
        }
      }
    }));
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
      const data = await adminFetch<{
        message?: string;
        siteSettings?: SiteSettingsRecord;
      }>("/api/site-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }, "Public Site settings could not be saved.");

      if (!data.siteSettings) {
        throw new Error(data.message ?? "Save failed.");
      }

      setSettings(data.siteSettings);
      setSocialLinksText(serializeLinkRows(data.siteSettings.social_links));
      setSaveState("saved");
      setMessage("Public site settings saved.");
    } catch (error) {
      setSaveState("error");
      setMessage(getAdminErrorMessage(error, "Save failed unexpectedly."));
    }
  }

  return (
    <>
      <section className="command-surface mb-6 px-5 py-6 sm:px-6 sm:py-7" ref={headerRef}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="pill">
              <Globe2 size={12} />
              Public Site
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              Public site management
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Manage the public vvviruz website separately from daily release
              operations. This page controls shared profile copy, public imagery,
              homepage content, the mobile link hub, exclusive track offer, and
              future-ready tracking settings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="pill">{statusLabel}</span>
            <button className="action-button-primary" onClick={handleSave} type="button">
              <Save size={16} />
              Save Site Settings
            </button>
            <Link className="action-button-secondary" href="/admin/releases">
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </section>

      <StickyActionDock
        isVisible={isCommandDockVisible}
        label="Public Site Management"
        statusSlot={<span className="pill text-xs">{statusLabel}</span>}
        primaryActionSlot={
          <button className="action-button-primary !py-2 !px-4 text-sm flex items-center gap-2" onClick={handleSave} type="button">
            <Save size={14} />
            <span className="hidden sm:inline">Save Site Settings</span>
            <span className="sm:hidden">Save</span>
          </button>
        }
        secondaryActionsSlot={
          <Link className="action-button-secondary !py-2 !px-3 text-sm hidden sm:inline-flex" href="/admin/releases">
            <ArrowLeft size={14} />
            <span className="hidden md:inline">Back to Dashboard</span>
          </Link>
        }
      />

      <SiteSettingsSectionNavigation variant="inline" />

      <section className="command-surface min-w-0 space-y-6 px-5 py-6 pb-36 sm:px-6 sm:py-7">
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
              Manage the global public copy, navigation, projects, landing experiences,
              and operational settings that still require regular updates. Releases
              continue to own release-specific content.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="core-profile">
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

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="metadata-seo">
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

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="site-chrome">
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
              <span className="field-label">On Repeat Nav Label</span>
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

            {([
              ["nav_projects_label", "Nav Projects Label"],
              ["nav_artists_label", "Nav Artist Profiles Label"],
              ["nav_commissions_label", "Nav Commissions Label"],
              ["nav_vault_label", "Nav Vault Label"],
              ["nav_more_label", "Nav More Label"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2" key={key}>
                <span className="field-label">{label}</span>
                <input
                  className="field-input"
                  onChange={(event) => updateSiteContent("chrome", key, event.target.value)}
                  value={settings.site_content.chrome[key]}
                />
              </label>
            ))}

            <fieldset className="rounded-lg border border-edge bg-input p-4 md:col-span-2">
              <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Desktop “More” menu placement
              </legend>
              <p className="mb-3 text-xs leading-5 text-muted">
                Checked destinations move into the desktop More menu. Mobile navigation still lists every destination directly.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["/projects", settings.site_content.chrome.nav_projects_label],
                  ["/artists", settings.site_content.chrome.nav_artists_label],
                  ["/commissions", settings.site_content.chrome.nav_commissions_label],
                  ["/vault", settings.site_content.chrome.nav_vault_label],
                  ["/about", settings.site_content.chrome.nav_about_label],
                  ["/exclusives", settings.site_content.chrome.nav_exclusive_label],
                  ["/links", settings.site_content.chrome.nav_links_label],
                  ["/music", settings.site_content.chrome.nav_music_label]
                ] as const).map(([href, label]) => (
                  <label className="flex items-center gap-2 text-sm text-ink" key={href}>
                    <input
                      checked={settings.site_content.chrome.desktop_more_hrefs.includes(href)}
                      onChange={(event) => {
                        const current = settings.site_content.chrome.desktop_more_hrefs;
                        updateSiteContent(
                          "chrome",
                          "desktop_more_hrefs",
                          event.target.checked
                            ? [...current, href]
                            : current.filter((value) => value !== href)
                        );
                      }}
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

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

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="home-page">
          <div>
            <p className="field-label">Section 4</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Home Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
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

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Recent Releases Description</span>
              <textarea
                className="field-input min-h-[80px]"
                onChange={(event) =>
                  updateSiteContent("home", "recent_releases_description", event.target.value)
                }
                value={settings.site_content.home.recent_releases_description}
              />
            </label>

            <div className="space-y-5 rounded-lg border border-edge bg-surface p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="field-label">Lock-In Spotlight</span>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                    The homepage always opens with this campaign-style takeover. Choose one
                    published release, or leave the selection blank to use Beast Mode and the
                    branded Lock-In Protocol fallback.
                  </p>
                </div>
                <span className="pill border-emerald-400/30 text-emerald-200">
                  Homepage primary
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="field-label">Eyebrow</span>
                  <input
                    className="field-input"
                    maxLength={40}
                    onChange={(event) =>
                      updateSiteContent("home", "lock_in_spotlight_eyebrow", event.target.value)
                    }
                    value={settings.site_content.home.lock_in_spotlight_eyebrow}
                  />
                </label>
                <label className="space-y-2">
                  <span className="field-label">CTA Label</span>
                  <input
                    className="field-input"
                    maxLength={32}
                    onChange={(event) =>
                      updateSiteContent("home", "lock_in_spotlight_cta_label", event.target.value)
                    }
                    value={settings.site_content.home.lock_in_spotlight_cta_label}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Headline</span>
                  <input
                    className="field-input"
                    maxLength={64}
                    onChange={(event) =>
                      updateSiteContent("home", "lock_in_spotlight_headline", event.target.value)
                    }
                    value={settings.site_content.home.lock_in_spotlight_headline}
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Statement</span>
                  <input
                    className="field-input"
                    maxLength={120}
                    onChange={(event) =>
                      updateSiteContent("home", "lock_in_spotlight_statement", event.target.value)
                    }
                    value={settings.site_content.home.lock_in_spotlight_statement}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="field-label">Spotlight Release</span>
                    <p className="mt-1 text-xs text-muted">
                      {validExplicitSpotlightRelease
                        ? "Explicit selection"
                        : resolvedSpotlightRelease
                          ? "Beast Mode fallback"
                          : "Lock-In Protocol fallback"}
                    </p>
                  </div>
                  {spotlightReleaseId ? (
                    <button
                      className="action-button-secondary !px-3 !py-2 text-xs"
                      onClick={() => setLockInSpotlightReleaseId("")}
                      type="button"
                    >
                      Use Beast Mode fallback
                    </button>
                  ) : null}
                </div>

                {resolvedSpotlightRelease ? (
                  <article className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-edge bg-surface-elevated px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{resolvedSpotlightRelease.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                        {resolvedSpotlightRelease.type} / {resolvedSpotlightRelease.status}
                      </p>
                    </div>
                    <Link
                      className="action-button-secondary !px-2 !py-2"
                      href={`/music/${resolvedSpotlightRelease.slug}`}
                      target="_blank"
                      title="Open public release"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </article>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-blue-200">
                    <CheckCircle2 size={14} /> The branded Lock-In Protocol fallback will render.
                  </p>
                )}

                <label className="space-y-2">
                  <span className="field-label">Choose Published Release</span>
                  <input
                    className="field-input"
                    onChange={(event) => setLockInReleaseQuery(event.target.value)}
                    placeholder="Search published releases"
                    value={lockInReleaseQuery}
                  />
                </label>

                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-edge bg-input p-3">
                  {filteredLockInReleaseOptions.length > 0 ? (
                    filteredLockInReleaseOptions.map((release) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-edge bg-surface px-4 py-3 text-left transition hover:border-[rgba(246,201,69,0.35)] hover:bg-surface-hover"
                        key={release.id}
                        onClick={() => setLockInSpotlightReleaseId(release.id)}
                        type="button"
                      >
                        <div>
                          <p className="text-sm font-semibold text-ink">{release.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                            {release.type} / {release.status}
                          </p>
                        </div>
                        <span className="pill">Select</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-sm text-muted">
                      No additional published releases match this search.
                    </p>
                  )}
                </div>
              </div>

              {spotlightReadinessWarnings.length > 0 ? (
                <div className="space-y-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
                  <p className="font-semibold">Readiness notes</p>
                  {spotlightReadinessWarnings.map((warning) => (
                    <p className="flex items-start gap-2" key={warning}>
                      <AlertTriangle className="mt-0.5 shrink-0" size={14} /> {warning}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 size={14} /> Spotlight ready
                </p>
              )}

              <div className="overflow-hidden rounded-md border border-edge">
                <LockInSpotlight
                  ctaLabel={settings.site_content.home.lock_in_spotlight_cta_label}
                  eyebrow={settings.site_content.home.lock_in_spotlight_eyebrow}
                  headline={settings.site_content.home.lock_in_spotlight_headline}
                  preview
                  release={
                    resolvedSpotlightRelease
                      ? {
                          coverArtAltText: `${resolvedSpotlightRelease.title} cover art`,
                          coverArtPath: resolvedSpotlightRelease.cover_art_path,
                          id: resolvedSpotlightRelease.id,
                          slug: resolvedSpotlightRelease.slug,
                          title: resolvedSpotlightRelease.title
                        }
                      : null
                  }
                  statement={settings.site_content.home.lock_in_spotlight_statement}
                />
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-edge bg-surface p-4 md:col-span-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="field-label">Homepage Exclusives CTA</span>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  The section remains tied to the existing Insider Access offer and route.
                </p>
              </div>
              <label className="space-y-2">
                <span className="field-label">Eyebrow</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateSiteContent("home", "exclusive_cta_eyebrow", event.target.value)
                  }
                  value={settings.site_content.home.exclusive_cta_eyebrow}
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Heading</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateSiteContent("home", "exclusive_cta_heading", event.target.value)
                  }
                  value={settings.site_content.home.exclusive_cta_heading}
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Description</span>
                <textarea
                  className="field-input min-h-[96px]"
                  onChange={(event) =>
                    updateSiteContent(
                      "home",
                      "exclusive_cta_description",
                      event.target.value
                    )
                  }
                  value={settings.site_content.home.exclusive_cta_description}
                />
              </label>
            </div>

          </div>
        </section>

        <section
          className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5"
          id="public-projects"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="field-label">Public Projects</p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">
                Approval, order, and eligibility
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Approved categories are evaluated by the shared public project rules.
                Approval never bypasses missing descriptions or the two-published-release requirement.
              </p>
            </div>
            <span className="pill">
              {eligibleProjectSlugs.length}/{approvedProjectSlugs.length} public
            </span>
          </div>

          <div className="mt-5 grid gap-5 rounded-lg border border-edge bg-input p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="field-label">Homepage projects section</p>
            </div>
            {([
              ["homepage_eyebrow", "Eyebrow"],
              ["homepage_heading", "Heading"],
              ["homepage_card_cta_label", "Card CTA"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2" key={key}>
                <span className="field-label">{label}</span>
                <input className="field-input" onChange={(event) => updateSiteContent("projects", key, event.target.value)} value={settings.site_content.projects[key]}/>
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Description</span>
              <textarea className="field-input min-h-[90px]" onChange={(event) => updateSiteContent("projects", "homepage_description", event.target.value)} value={settings.site_content.projects.homepage_description}/>
            </label>

            <div className="mt-2 border-t border-edge pt-5 md:col-span-2">
              <p className="field-label">Projects index and empty states</p>
            </div>
            {([
              ["index_meta_title", "Search title"],
              ["index_heading", "Page heading"],
              ["index_browse_label", "Browse music CTA"],
              ["index_card_cta_label", "Project card CTA"],
              ["empty_heading", "Empty-state heading"],
              ["empty_cta_label", "Empty-state CTA"],
              ["not_found_eyebrow", "Not-found eyebrow"],
              ["not_found_heading", "Not-found heading"],
              ["not_found_cta_label", "Not-found CTA"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2" key={key}>
                <span className="field-label">{label}</span>
                <input className="field-input" onChange={(event) => updateSiteContent("projects", key, event.target.value)} value={settings.site_content.projects[key]}/>
              </label>
            ))}
            {([
              ["index_meta_description", "Search description"],
              ["index_description", "Page description"],
              ["empty_description", "Empty-state description"],
              ["not_found_description", "Not-found description"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2 md:col-span-2" key={key}>
                <span className="field-label">{label}</span>
                <textarea className="field-input min-h-[80px]" onChange={(event) => updateSiteContent("projects", key, event.target.value)} value={settings.site_content.projects[key]}/>
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {projectRows.map((row) => {
              const category = row.category;
              const isEligible = row.eligibility.eligible;
              const homepageIndex = eligibleProjectSlugs.indexOf(row.slug);
              const appearsOnHomepage =
                isEligible && homepageIndex >= 0 && homepageIndex < HOMEPAGE_PROJECT_LIMIT;
              const artworkRelease = row.publishedReleases.find(
                (release) => release.cover_art_path
              );

              return (
                <article className="rounded-lg border border-edge bg-surface p-4" key={row.slug}>
                  <div className="grid gap-4 lg:grid-cols-[72px_minmax(0,1fr)_auto] lg:items-start">
                    <span className="relative h-[72px] w-[72px] overflow-hidden rounded-md border border-edge bg-surface-elevated">
                      {artworkRelease?.cover_art_path ? (
                        <Image
                          alt={`${category?.name || row.slug} artwork preview`}
                          className="object-cover"
                          fill
                          sizes="72px"
                          src={artworkRelease.cover_art_path}
                          unoptimized
                        />
                      ) : null}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-ink">
                          {category?.name || row.slug}
                        </h4>
                        <span
                          className={`pill text-[10px] ${
                            isEligible
                              ? "border-emerald-400/30 text-emerald-200"
                              : "border-amber-400/30 text-amber-200"
                          }`}
                        >
                          {isEligible ? "Public" : "Approved, not eligible"}
                        </span>
                        {appearsOnHomepage ? (
                          <span className="pill text-[10px]">Homepage</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
                        {row.slug} / {row.publishedReleases.length} published releases
                      </p>
                      <p
                        className={`mt-3 flex items-center gap-2 text-sm ${
                          isEligible ? "text-emerald-300" : "text-amber-200"
                        }`}
                      >
                        {isEligible ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {getProjectEligibilityMessage(row.eligibility.reason)}
                      </p>
                      {!artworkRelease?.cover_art_path ? (
                        <p className="mt-2 text-xs text-muted">
                          Representative artwork is unavailable; the public placeholder will be used.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        aria-label={`Move ${category?.name || row.slug} earlier`}
                        className="action-button-secondary !px-2 !py-2"
                        disabled={row.index === 0}
                        onClick={() => moveApprovedProject(row.slug, -1)}
                        type="button"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        aria-label={`Move ${category?.name || row.slug} later`}
                        className="action-button-secondary !px-2 !py-2"
                        disabled={row.index === projectRows.length - 1}
                        onClick={() => moveApprovedProject(row.slug, 1)}
                        type="button"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <a
                        className="action-button-secondary !px-3 !py-2 text-xs"
                        href="#music-categories"
                      >
                        Edit content
                      </a>
                      {isEligible ? (
                        <Link
                          className="action-button-secondary !px-2 !py-2"
                          href={getPublicProjectPath(row.slug)}
                          target="_blank"
                          title="Open public project"
                        >
                          <ExternalLink size={14} />
                        </Link>
                      ) : null}
                      <button
                        className="action-button-secondary !px-3 !py-2 text-xs"
                        onClick={() => removeApprovedProject(row.slug)}
                        type="button"
                      >
                        Remove approval
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {projectRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-edge px-4 py-7 text-center text-sm text-muted">
                No categories are approved as public projects. The Projects index will remain empty.
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 rounded-lg border border-edge bg-input p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-2">
              <span className="field-label">Add Existing Category</span>
              <select
                className="field-input"
                onChange={(event) => setProjectCandidateSlug(event.target.value)}
                value={projectCandidateSlug}
              >
                <option value="">Select a category</option>
                {availableProjectCategories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name} ({category.slug})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="action-button-primary"
              disabled={!projectCandidateSlug}
              onClick={addApprovedProject}
              type="button"
            >
              Approve Project
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-muted">
            Names, slugs, descriptions, and release assignments remain owned by Music Categories below.
            Removing approval never deletes those records or their legacy music filters.
          </p>
        </section>

        <section className="rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5">
          <div>
            <p className="field-label">Directory + return rail</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Artist Profiles and Latest Intel</h3>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {([
              ["metadata_title", "Artist directory search title"],
              ["eyebrow", "Directory eyebrow"],
              ["heading", "Directory heading"],
              ["card_eyebrow", "Profile card eyebrow"],
              ["empty_eyebrow", "Empty-state eyebrow"],
              ["empty_heading", "Empty-state heading"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2" key={key}>
                <span className="field-label">{label}</span>
                <input className="field-input" onChange={(event) => updateSiteContent("artist_directory", key, event.target.value)} value={settings.site_content.artist_directory[key]}/>
              </label>
            ))}
            {([
              ["metadata_description", "Artist directory search description"],
              ["description", "Directory description"],
              ["empty_description", "Empty-state description"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2 md:col-span-2" key={key}>
                <span className="field-label">{label}</span>
                <textarea className="field-input min-h-[80px]" onChange={(event) => updateSiteContent("artist_directory", key, event.target.value)} value={settings.site_content.artist_directory[key]}/>
              </label>
            ))}
            <label className="space-y-2">
              <span className="field-label">Latest Intel rail label</span>
              <input className="field-input" onChange={(event) => updateSiteContent("intel", "rail_label", event.target.value)} value={settings.site_content.intel.rail_label}/>
            </label>
            <label className="space-y-2">
              <span className="field-label">Latest Intel CTA</span>
              <input className="field-input" onChange={(event) => updateSiteContent("intel", "cta_label", event.target.value)} value={settings.site_content.intel.cta_label}/>
            </label>
          </div>
        </section>

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="music-page">
          <div>
            <p className="field-label">Section 5</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Music Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
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

            {([
              ["releases_tab_label", "Releases tab"],
              ["appears_on_tab_label", "Appears On tab"],
              ["browse_projects_label", "Browse Projects CTA"],
              ["showing_label", "Active filter label"],
              ["open_project_label", "Open project CTA"],
              ["clear_filter_label", "Clear filter CTA"],
              ["search_label", "Search label"],
              ["search_placeholder", "Search placeholder"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2" key={key}>
                <span className="field-label">{label}</span>
                <input className="field-input" onChange={(event) => updateSiteContent("music", key, event.target.value)} value={settings.site_content.music[key]}/>
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Appears On empty state</span>
              <textarea className="field-input min-h-[80px]" onChange={(event) => updateSiteContent("music", "appears_on_empty_text", event.target.value)} value={settings.site_content.music.appears_on_empty_text}/>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Search no-results state</span>
              <textarea className="field-input min-h-[80px]" onChange={(event) => updateSiteContent("music", "search_empty_text", event.target.value)} value={settings.site_content.music.search_empty_text}/>
            </label>
          </div>
        </section>

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="about-page">
          <div>
            <p className="field-label">Section 6</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">About Page</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
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

            <div className="mt-2 border-t border-edge pt-5 md:col-span-2">
              <p className="field-label">Catalog calls to action</p>
            </div>
            {([
              ["hero_cta_label", "Hero music CTA"],
              ["catalog_eyebrow", "Catalog eyebrow"],
              ["catalog_heading", "Catalog heading"],
              ["catalog_primary_cta_label", "Catalog primary CTA"],
              ["catalog_secondary_cta_label", "Catalog secondary CTA"]
            ] as const).map(([key, label]) => (
              <label className="space-y-2" key={key}>
                <span className="field-label">{label}</span>
                <input className="field-input" onChange={(event) => updateSiteContent("about", key, event.target.value)} value={settings.site_content.about[key]}/>
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Catalog description</span>
              <textarea className="field-input min-h-[90px]" onChange={(event) => updateSiteContent("about", "catalog_description", event.target.value)} value={settings.site_content.about.catalog_description}/>
            </label>
          </div>
        </section>

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="platform-labels">
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

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="links-page">
          <div>
            <p className="field-label">Section 8</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Link Hub Defaults</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Global default fallback texts for campaign landing pages.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
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

        <div className="scroll-mt-36" id="exclusives-settings">
          <ExclusiveOfferSettingsPanel
            exclusiveOffer={settings.site_content.exclusive}
            releaseOptions={releaseOptions}
            vaultReleaseIds={vaultReleaseIds}
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
        </div>

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="tracking-settings">
          <div>
            <p className="field-label">Section 11</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">Tracking</h3>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Enable Meta Pixel</span>
              <button
                className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition ${
                  settings.site_content.analytics.meta_pixel_enabled
                    ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                    : "border-edge-strong bg-surface text-secondary hover:border-edge hover:bg-surface-hover"
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

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="release-page">
          <div>
            <p className="field-label">Section 12</p>
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

        <section className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5" id="social-links">
          <div>
            <p className="field-label">Section 13</p>
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

        <div className="scroll-mt-36" id="vault-settings">
          <VaultSettingsPanel
            onChange={(vault) => {
              setSettings((current) => ({
                ...current,
                site_content: {
                  ...current.site_content,
                  vault
                }
              }));
            }}
            vaultSettings={settings.site_content.vault}
          />
        </div>

        <div className="scroll-mt-36" id="commissions-settings">
          <CommissionsSettingsPanel
            commissionsSettings={settings.site_content.commissions}
            onChange={(commissions) => {
              setSettings((current) => ({
                ...current,
                site_content: {
                  ...current.site_content,
                  commissions
                }
              }));
            }}
          />
        </div>
      </div>

      <section
        className="scroll-mt-36 rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5"
        id="public-readiness"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Public Readiness</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">
              Preview the current public configuration
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Warnings describe incomplete public surfaces without blocking unrelated settings.
            </p>
          </div>
          <span
            className={`pill ${
              publicReadinessWarnings.length === 0
                ? "border-emerald-400/30 text-emerald-200"
                : "border-amber-400/30 text-amber-200"
            }`}
          >
            {publicReadinessWarnings.length === 0
              ? "Public surfaces ready"
              : `${publicReadinessWarnings.length} items to review`}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["Homepage", "/"],
            ["Music", "/music"],
            ["Projects", "/projects"],
            ["About", "/about"],
            ["Exclusives", "/exclusives"]
          ].map(([label, href]) => (
            <Link
              className="action-button-secondary !px-3 !py-2 text-xs"
              href={href}
              key={href}
              target="_blank"
            >
              {label} <ExternalLink size={13} />
            </Link>
          ))}
          {eligibleProjectSlugs.map((slug) => (
            <Link
              className="action-button-secondary !px-3 !py-2 text-xs"
              href={getPublicProjectPath(slug)}
              key={slug}
              target="_blank"
            >
              {releaseCategories.find((category) => category.slug === slug)?.name || slug}
              <ExternalLink size={13} />
            </Link>
          ))}
          {resolvedSpotlightRelease ? (
            <Link
              className="action-button-secondary !px-3 !py-2 text-xs"
              href={`/music/${resolvedSpotlightRelease.slug}`}
              target="_blank"
            >
              Spotlight release <ExternalLink size={13} />
            </Link>
          ) : null}
        </div>

        {publicReadinessWarnings.length > 0 ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {publicReadinessWarnings.map((warning) => (
              <p
                className="flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-sm text-amber-100"
                key={warning}
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="field-label">Public site control map</p>
            <h3 className="mt-3 text-2xl font-semibold text-ink">
              Copy, images, links, and tracking are admin-editable
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Use this page to update the public header, nav labels, homepage Spotlight,
              carousel images, About copy/image, social links,
              link-page campaign release, exclusive track offer, CTA labels, SEO text,
              and Meta Pixel setup without changing code.
            </p>
          </div>
          <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary sm:grid-cols-2">
            <span className="pill">Copy</span>
            <span className="pill">Images</span>
            <span className="pill">Links</span>
            <span className="pill">Tracking</span>
          </div>
        </div>
      </section>
      {message ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            saveState === "error"
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {message}
        </div>
      ) : null}
      </section>
    </>
  );
}
