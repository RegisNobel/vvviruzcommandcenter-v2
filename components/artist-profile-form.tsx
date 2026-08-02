"use client";

import Image from "next/image";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {
  approveArtistProfileAction,
  createArtistReleaseAction,
  createArtistPreviewAction,
  promoteArtistHomepageItemToEditorialAction,
  publishArtistProfileAction,
  revokeArtistPreviewAction,
  saveArtistProfileAction
} from "@/app/admin/(protected)/artists/actions";
import type {
  ArtistProfileEditorRecord,
  ArtistProfileExpansionConfig,
  ArtistProfileFeaturedItem,
  ArtistProfileLink,
  ArtistProfilePageCopy
} from "@/lib/artist-profiles";
import {
  ARTIST_THEME_FAMILIES,
  DEFAULT_ARTIST_EXPANSION_CONFIG,
  DEFAULT_ARTIST_PAGE_COPY,
  MAX_ARTIST_HOMEPAGE_RELEASE_PLACEMENTS,
  normalizeArtistFeaturedItems,
  normalizeArtistFeaturedStories
} from "@/lib/artist-profiles";
import {adminFetch, getAdminErrorMessage} from "@/lib/admin-errors";
import {COUNTRY_OPTIONS} from "@/lib/countries";
import type {ReleaseCoverUploadResponse} from "@/lib/types";

type Draft = {
  id?: string;
  slug: string;
  displayName: string;
  privateContactEmail: string;
  location: string;
  locationCountryCode: string;
  themeFamily: string;
  longBio: string;
  differentiator: string;
  genres: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  profileImagePath: string;
  profileImageAlt: string;
  pageCopy: ArtistProfilePageCopy;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
  links: ArtistProfileLink[];
  featuredItems: ArtistProfileFeaturedItem[];
  featuredStories: ArtistProfileFeaturedItem[];
  expansion: ArtistProfileExpansionConfig;
};

const emptyLink = (): ArtistProfileLink => ({platform: "", label: "", url: "", isPrimary: false});
const emptyItem = (isStartHere = false): ArtistProfileFeaturedItem => ({
  itemType: "track",
  eyebrow: "",
  title: "",
  subtitle: "",
  description: "",
  url: "",
  coverArtUrl: "",
  coverArtAlt: "",
  isStartHere
});

function moveEntry<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

function initialDraft(record?: ArtistProfileEditorRecord): Draft {
  return {
    id: record?.artistProfileId,
    slug: record?.slug || "",
    displayName: record?.displayName || "",
    privateContactEmail: record?.privateContactEmail || "",
    location: record?.location || "",
    locationCountryCode: record?.locationCountryCode || "",
    themeFamily: record?.themeFamily || "signal-noir",
    longBio: record?.longBio || "",
    differentiator: record?.differentiator || "",
    genres: record?.genres.join(", ") || "",
    primaryCtaLabel: record?.primaryCta.label || "",
    primaryCtaUrl: record?.primaryCta.url || "",
    secondaryCtaLabel: record?.secondaryCta.label || "",
    secondaryCtaUrl: record?.secondaryCta.url || "",
    profileImagePath: record?.profileImage.url || "",
    profileImageAlt: record?.profileImage.alt || "",
    pageCopy: record?.pageCopy || DEFAULT_ARTIST_PAGE_COPY,
    seoTitle: record?.seo.title || "",
    seoDescription: record?.seo.description || "",
    socialImageUrl: record?.seo.socialImageUrl || "",
    links: record?.links.length ? record.links : [emptyLink()],
    featuredItems: record?.featuredItems.length
      ? normalizeArtistFeaturedItems(record.featuredItems)
      : [emptyItem(true)],
    featuredStories: normalizeArtistFeaturedStories(record?.featuredStories ?? []),
    expansion: record?.expansion || DEFAULT_ARTIST_EXPANSION_CONFIG
  };
}

export function ArtistProfileForm({initialRecord}: {initialRecord?: ArtistProfileEditorRecord}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(initialRecord));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [approvalEmail, setApprovalEmail] = useState(initialRecord?.privateContactEmail || "");
  const [uploadingImage, setUploadingImage] = useState("");
  const latestVersion = initialRecord?.latestVersion;

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({...current, [key]: value}));

  const uploadImage = async (
    key: string,
    file: File,
    onUploaded: (url: string) => void
  ) => {
    setUploadingImage(key);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const payload = await adminFetch<
        ReleaseCoverUploadResponse & {message?: string}
      >(
        "/api/releases/cover-upload",
        {method: "POST", body: formData},
        "Image upload failed."
      );
      if (!payload.asset?.url) {
        throw new Error(payload.message || "Image upload failed.");
      }
      onUploaded(payload.asset.url);
      setMessage("Image uploaded. Save the artist draft to keep the change.");
    } catch (error) {
      setMessage(getAdminErrorMessage(error, "Image upload failed."));
    } finally {
      setUploadingImage("");
    }
  };

  const save = async () => {
    setBusy("save");
    setMessage("");
    const result = await saveArtistProfileAction({
      ...draft,
      genres: draft.genres.split(",").map((value) => value.trim()).filter(Boolean),
      links: draft.links.filter((link) => link.url.trim()),
      featuredItems: normalizeArtistFeaturedItems(
        draft.featuredItems.filter(
          (item) => item.title.trim() && (item.url.trim() || item.releaseId)
        )
      ),
      featuredStories: normalizeArtistFeaturedStories(
        draft.featuredStories.filter(
          (item) => item.title.trim() && (item.url.trim() || item.releaseId)
        )
      )
    });
    setBusy("");
    if (!result.ok) {
      setMessage(result.message || "Unable to save.");
      return;
    }
    if (!initialRecord) {
      router.push(`/admin/artists/${result.data}`);
    } else {
      setMessage("Draft saved. Existing preview versions remain unchanged.");
      router.refresh();
    }
  };

  const createRelease = async () => {
    if (!initialRecord) return;
    setBusy("release");
    setMessage("");
    const result = await createArtistReleaseAction(initialRecord.artistProfileId);
    setBusy("");
    if (!result.ok || !result.data) {
      setMessage(
        ("message" in result ? result.message : "") ||
          "Unable to create the artist release."
      );
      return;
    }
    router.push(
      `/admin/artists/${initialRecord.artistProfileId}/releases/${result.data}`
    );
  };

  const promoteHomepageItem = async (
    item: ArtistProfileFeaturedItem,
    index: number
  ) => {
    if (!initialRecord) return;
    const busyKey = `promote-${index}`;
    setBusy(busyKey);
    setMessage("");
    const result = await promoteArtistHomepageItemToEditorialAction({
      artistProfileId: initialRecord.artistProfileId,
      featuredItemId: item.placementId,
      featuredItemIndex: index,
      title: item.title,
      description: item.description,
      url: item.url,
      coverArtUrl: item.coverArtUrl,
      coverArtAlt: item.coverArtAlt
    });
    setBusy("");
    if (!result.ok || !result.data) {
      setMessage(
        ("message" in result ? result.message : "") ||
          "Unable to promote this release."
      );
      return;
    }
    router.push(
      `/admin/artists/${initialRecord.artistProfileId}/releases/${result.data}`
    );
  };

  const createPreview = async () => {
    if (!initialRecord) return;
    setBusy("preview");
    setMessage("");
    const result = await createArtistPreviewAction(initialRecord.artistProfileId);
    setBusy("");
    if (!result.ok || !result.data) {
      setMessage(result.message || "Unable to create preview.");
      return;
    }
    const absolutePreviewUrl = new URL(result.data.path, window.location.origin).toString();
    setPreviewUrl(absolutePreviewUrl);
    window.open(absolutePreviewUrl, "_blank", "noopener,noreferrer");
    setMessage(`Private version ${result.data.version} created in a new tab.`);
    router.refresh();
  };

  const approve = async () => {
    if (!initialRecord || !latestVersion) return;
    const normalizedApprovalEmail = approvalEmail.trim();
    const confirmationMessage = normalizedApprovalEmail
      ? `Confirm that ${normalizedApprovalEmail} approved ${initialRecord.displayName} profile version ${latestVersion.version} outside this system?`
      : `Confirm that ${initialRecord.displayName} profile version ${latestVersion.version} was approved outside this system? No approver email will be recorded.`;
    if (
      !window.confirm(confirmationMessage)
    ) {
      return;
    }
    setBusy("approve");
    setMessage("");
    const result = await approveArtistProfileAction({
      artistProfileId: initialRecord.artistProfileId,
      versionId: latestVersion.id,
      decidedByEmail: normalizedApprovalEmail,
      notes: "Off-platform approval confirmed by an authenticated administrator."
    });
    setBusy("");
    setMessage(result.ok ? "Approval recorded. This version is now eligible to publish." : result.message);
    router.refresh();
  };

  const publish = async () => {
    if (!initialRecord || !latestVersion) return;
    if (
      !window.confirm(
        `Publish ${initialRecord.displayName} profile version ${latestVersion.version}? This will replace the currently published version.`
      )
    ) {
      return;
    }
    setBusy("publish");
    setMessage("");
    const result = await publishArtistProfileAction(initialRecord.artistProfileId, latestVersion.id);
    setBusy("");
    setMessage(result.ok ? "Approved version published." : result.message);
    router.refresh();
  };

  const revokePreview = async () => {
    if (!initialRecord || !latestVersion) return;
    if (
      !window.confirm(
        `Revoke the private review link for ${initialRecord.displayName} version ${latestVersion.version}?`
      )
    ) {
      return;
    }
    setBusy("revoke");
    setMessage("");
    const result = await revokeArtistPreviewAction({
      artistProfileId: initialRecord.artistProfileId,
      versionId: latestVersion.id
    });
    setBusy("");
    setMessage(
      result.ok
        ? "Private preview revoked."
        : result.message
    );
    router.refresh();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="command-surface space-y-5 p-5 sm:p-6">
          <div>
            <p className="field-label">Identity & public story</p>
            <p className="mt-2 text-sm text-muted">
              Private contact details stay in the command center and never enter a public version.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" value={draft.displayName} onChange={(value) => update("displayName", value)} />
            <Field label="Slug" value={draft.slug} onChange={(value) => update("slug", value)} />
            <SelectField
              label="Public country"
              value={draft.locationCountryCode}
              onChange={(value) => {
                const country = COUNTRY_OPTIONS.find(
                  (option) => option.code === value
                );
                setDraft((current) => ({
                  ...current,
                  locationCountryCode: value,
                  location: country?.label || ""
                }));
              }}
              options={[
                {label: "No public country", value: ""},
                ...COUNTRY_OPTIONS.map((country) => ({
                  label: country.label,
                  value: country.code
                }))
              ]}
            />
            <SelectField
              label="Theme family"
              value={draft.themeFamily}
              onChange={(value) => update("themeFamily", value)}
              options={ARTIST_THEME_FAMILIES.map((theme) => ({label: theme.label, value: theme.value}))}
            />
            <Field label="Private email (optional)" type="email" value={draft.privateContactEmail} onChange={(value) => update("privateContactEmail", value)} />
            <Field label="Genres (comma separated)" value={draft.genres} onChange={(value) => update("genres", value)} />
          </div>
          <TextField label="Editorial biography" rows={7} value={draft.longBio} onChange={(value) => update("longBio", value)} />
          <TextField label="Creative distinction" rows={3} value={draft.differentiator} onChange={(value) => update("differentiator", value)} />
        </section>

        <section className="command-surface space-y-5 p-5 sm:p-6">
          <p className="field-label">Profile image & calls to action</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageSourceField
              id="artist-profile-image"
              label="Profile image"
              uploading={uploadingImage === "profile"}
              value={draft.profileImagePath}
              onChange={(value) => update("profileImagePath", value)}
              onUpload={(file) => uploadImage("profile", file, (url) => update("profileImagePath", url))}
            />
            <Field label="Image alt text" value={draft.profileImageAlt} onChange={(value) => update("profileImageAlt", value)} />
            <Field label="Primary CTA label" value={draft.primaryCtaLabel} onChange={(value) => update("primaryCtaLabel", value)} />
            <Field label="Primary CTA URL" value={draft.primaryCtaUrl} onChange={(value) => update("primaryCtaUrl", value)} />
            <Field label="Secondary CTA label" value={draft.secondaryCtaLabel} onChange={(value) => update("secondaryCtaLabel", value)} />
            <Field label="Secondary CTA URL" value={draft.secondaryCtaUrl} onChange={(value) => update("secondaryCtaUrl", value)} />
          </div>
        </section>

        <section className="command-surface space-y-5 p-5 sm:p-6">
          <div>
            <p className="field-label">Page language</p>
            <p className="mt-2 text-sm text-muted">
              These fields control every artist-specific heading and label in the shared layout.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signal label" value={draft.pageCopy.signalLabel} onChange={(value) => update("pageCopy", {...draft.pageCopy, signalLabel: value})} />
            <Field label="Hero eyebrow" value={draft.pageCopy.heroEyebrow} onChange={(value) => update("pageCopy", {...draft.pageCopy, heroEyebrow: value})} />
            <Field label="Story section label" value={draft.pageCopy.storyLabel} onChange={(value) => update("pageCopy", {...draft.pageCopy, storyLabel: value})} />
            <Field label="Story heading" value={draft.pageCopy.storyHeading} onChange={(value) => update("pageCopy", {...draft.pageCopy, storyHeading: value})} />
            <Field label="Fingerprint heading" value={draft.pageCopy.fingerprintLabel} onChange={(value) => update("pageCopy", {...draft.pageCopy, fingerprintLabel: value})} />
            <Field label="Selected section label" value={draft.pageCopy.selectedLabel} onChange={(value) => update("pageCopy", {...draft.pageCopy, selectedLabel: value})} />
            <Field label="Selected section heading" value={draft.pageCopy.selectedHeading} onChange={(value) => update("pageCopy", {...draft.pageCopy, selectedHeading: value})} />
            <Field label="Platform section label" value={draft.pageCopy.platformLabel} onChange={(value) => update("pageCopy", {...draft.pageCopy, platformLabel: value})} />
          </div>
        </section>

        <section className="command-surface space-y-5 p-5 sm:p-6">
          <div>
            <p className="field-label">Search & sharing</p>
            <p className="mt-2 text-sm text-muted">
              Leave fields blank to use the display name, editorial biography, and profile image automatically.
            </p>
          </div>
          <Field label="SEO and share title" value={draft.seoTitle} onChange={(value) => update("seoTitle", value)} />
          <TextField label="SEO and share description" rows={3} value={draft.seoDescription} onChange={(value) => update("seoDescription", value)} />
          <ImageSourceField
            id="artist-social-image"
            label="Social share image"
            uploading={uploadingImage === "social"}
            value={draft.socialImageUrl}
            onChange={(value) => update("socialImageUrl", value)}
            onUpload={(file) => uploadImage("social", file, (url) => update("socialImageUrl", url))}
          />
        </section>

        <section className="command-surface space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="field-label">Platform links</p>
            <button className="action-button-secondary" onClick={() => update("links", [...draft.links, emptyLink()])} type="button">Add link</button>
          </div>
          {draft.links.map((link, index) => (
            <div className="grid gap-3 rounded-lg border border-edge bg-input p-4 sm:grid-cols-[130px_1fr_2fr_auto]" key={index}>
              <Field label="Platform" value={link.platform} onChange={(value) => update("links", draft.links.map((item, itemIndex) => itemIndex === index ? {...item, platform: value} : item))} />
              <Field label="Label" value={link.label} onChange={(value) => update("links", draft.links.map((item, itemIndex) => itemIndex === index ? {...item, label: value} : item))} />
              <Field label="URL" value={link.url} onChange={(value) => update("links", draft.links.map((item, itemIndex) => itemIndex === index ? {...item, url: value} : item))} />
              <div className="flex self-end">
                <button aria-label={`Move ${link.label || "link"} up`} className="px-2 py-2 text-sm text-muted hover:text-ink" disabled={index === 0} onClick={() => update("links", moveEntry(draft.links, index, index - 1))} type="button">↑</button>
                <button aria-label={`Move ${link.label || "link"} down`} className="px-2 py-2 text-sm text-muted hover:text-ink" disabled={index === draft.links.length - 1} onClick={() => update("links", moveEntry(draft.links, index, index + 1))} type="button">↓</button>
                <button className="px-2 py-2 text-sm text-muted hover:text-rose-300" onClick={() => update("links", draft.links.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
              </div>
              <label className="flex items-center gap-2 text-sm text-secondary sm:col-span-4">
                <input checked={Boolean(link.isPrimary)} onChange={(event) => update("links", draft.links.map((entry, itemIndex) => itemIndex === index ? {...entry, isPrimary: event.target.checked} : entry))} type="checkbox" />
                Primary platform
              </label>
            </div>
          ))}
        </section>

        <section className="command-surface space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="field-label">Featured music & projects</p>
              <p className="mt-2 text-sm text-muted">
                These are homepage placements, not a catalog limit. Choose one Start Here release and up to two supporting releases. Every placement automatically receives an editorial page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {initialRecord ? (
                <button className="action-button-secondary" disabled={Boolean(busy)} onClick={createRelease} type="button">
                  {busy === "release" ? "Creating…" : "Create editorial release"}
                </button>
              ) : null}
              <button
                className="action-button-secondary"
                disabled={draft.featuredItems.length >= MAX_ARTIST_HOMEPAGE_RELEASE_PLACEMENTS}
                onClick={() => update("featuredItems", [...draft.featuredItems, emptyItem()])}
                type="button"
              >
                Add homepage placement ({draft.featuredItems.length}/{MAX_ARTIST_HOMEPAGE_RELEASE_PLACEMENTS})
              </button>
            </div>
          </div>
          {initialRecord?.releaseOptions.some(
            (release) => release.catalogScope === "ARTIST"
          ) ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {initialRecord.releaseOptions
                .filter((release) => release.catalogScope === "ARTIST")
                .map((release) => (
                  <Link
                    className="flex items-center justify-between rounded-lg border border-edge bg-input px-4 py-3 text-sm transition hover:border-brand-primary/50"
                    href={`/admin/artists/${initialRecord.artistProfileId}/releases/${release.id}`}
                    key={release.id}
                  >
                    <span className="font-semibold text-ink">{release.title}</span>
                    <span className="text-muted">Edit →</span>
                  </Link>
                ))}
            </div>
          ) : null}
          {draft.featuredItems.map((item, index) => (
            <div className="space-y-4 rounded-lg border border-edge bg-input p-4" key={index}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Type" value={item.itemType} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, itemType: value as ArtistProfileFeaturedItem["itemType"]} : entry))} />
                <Field label="Eyebrow" value={item.eyebrow} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, eyebrow: value} : entry))} />
                <Field label="Title" value={item.title} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, title: value} : entry))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Internal editorial release"
                  onChange={(value) =>
                    update(
                      "featuredItems",
                      draft.featuredItems.map((entry, itemIndex) =>
                        itemIndex === index
                          ? {...entry, releaseId: value || undefined}
                          : entry
                      )
                    )
                  }
                  options={[
                    {label: "External link only", value: ""},
                    ...(initialRecord?.releaseOptions ?? []).map((release) => ({
                      label: `${release.title} · ${release.catalogScope === "ARTIST" ? "artist catalog" : "vvviruz catalog"}`,
                      value: release.id
                    }))
                  ]}
                  value={item.releaseId || ""}
                />
                <Field label="Subtitle" value={item.subtitle} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, subtitle: value} : entry))} />
                <Field label={item.releaseId ? "Fallback destination URL" : "Destination URL"} value={item.url} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, url: value} : entry))} />
                <ImageSourceField
                  id={`artist-release-image-${index}`}
                  label="Cover artwork"
                  uploading={uploadingImage === `release-${index}`}
                  value={item.coverArtUrl}
                  onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, coverArtUrl: value} : entry))}
                  onUpload={(file) => uploadImage(`release-${index}`, file, (url) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, coverArtUrl: url} : entry)))}
                />
                <Field label="Cover artwork alt text" value={item.coverArtAlt} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, coverArtAlt: value} : entry))} />
                <TextField label="Description" rows={2} value={item.description} onChange={(value) => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => itemIndex === index ? {...entry, description: value} : entry))} />
                {item.isStartHere ? (
                  <Field
                    label="Start Here button label"
                    value={draft.pageCopy.featuredButtonLabel}
                    onChange={(value) =>
                      update("pageCopy", {
                        ...draft.pageCopy,
                        featuredButtonLabel: value
                      })
                    }
                  />
                ) : null}
              </div>
              {item.releaseId && initialRecord ? (
                <Link
                  className="inline-flex text-sm font-semibold text-brand-primary hover:text-ink"
                  href={`/admin/artists/${initialRecord.artistProfileId}/releases/${item.releaseId}`}
                >
                  Open editorial release details →
                </Link>
              ) : initialRecord ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-edge px-4 py-3">
                  <button
                    className="action-button-secondary"
                    disabled={Boolean(busy)}
                    onClick={() => void promoteHomepageItem(item, index)}
                    type="button"
                  >
                    {busy === `promote-${index}`
                      ? "Promoting…"
                      : "Promote to editorial release"}
                  </button>
                  <p className="max-w-xl text-xs leading-5 text-muted">
                    Creates a managed release from this card and opens its story,
                    lyrics, and Breaking Barz editor. The homepage placement stays
                    intact.
                  </p>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-secondary">
                  <input
                    checked={item.isStartHere}
                    name="artist-featured-release"
                    onChange={() => update("featuredItems", draft.featuredItems.map((entry, itemIndex) => ({...entry, isStartHere: itemIndex === index})))}
                    type="radio"
                  />
                  Featured / Start Here
                </label>
                <div className="flex items-center gap-3">
                  <button className="text-sm text-muted hover:text-ink" disabled={index === 0} onClick={() => update("featuredItems", moveEntry(draft.featuredItems, index, index - 1))} type="button">Move up</button>
                  <button className="text-sm text-muted hover:text-ink" disabled={index === draft.featuredItems.length - 1} onClick={() => update("featuredItems", moveEntry(draft.featuredItems, index, index + 1))} type="button">Move down</button>
                  <button className="text-sm text-muted hover:text-rose-300" onClick={() => update("featuredItems", draft.featuredItems.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove item</button>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="command-surface space-y-6 p-5 sm:p-6">
          <div>
            <p className="field-label">Optional profile extensions</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Leave these off for the pilot. Turn them on only when this artist
              needs public pages or sections beyond the three homepage releases.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-edge bg-input p-4">
              <strong className="text-sm text-ink">Homepage releases</strong>
              <p className="mt-2 text-xs leading-5 text-muted">
                Managed above: one Start Here release and up to two supporting
                releases. Each one automatically gets a full editorial page.
              </p>
            </div>
            <div className="rounded-lg border border-edge bg-input p-4">
              <strong className="text-sm text-ink">All Releases page</strong>
              <p className="mt-2 text-xs leading-5 text-muted">
                A separate catalog for releases that should be discoverable
                without occupying one of the three homepage positions.
              </p>
            </div>
            <div className="rounded-lg border border-edge bg-input p-4">
              <strong className="text-sm text-ink">Featured Stories</strong>
              <p className="mt-2 text-xs leading-5 text-muted">
                An optional profile section for additional editorial deep dives.
                It does not create another Start Here release.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-edge bg-input p-4">
            <label className="flex items-start gap-3 text-sm text-secondary">
              <input
                checked={draft.expansion.catalogEnabled}
                className="mt-1"
                onChange={(event) =>
                  update("expansion", {
                    ...draft.expansion,
                    catalogEnabled: event.target.checked
                  })
                }
                type="checkbox"
              />
              <span>
                <strong className="block text-ink">
                  Publish a separate All Releases page
                </strong>
                Makes the artist catalog page public and adds a button to it on
                the artist homepage. Releases appear there only when selected
                below.
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="All Releases page title"
                value={draft.expansion.catalogTitle}
                onChange={(value) =>
                  update("expansion", {...draft.expansion, catalogTitle: value})
                }
              />
              <Field
                label="Button label on artist homepage"
                value={draft.expansion.catalogCtaLabel}
                onChange={(value) =>
                  update("expansion", {...draft.expansion, catalogCtaLabel: value})
                }
              />
            </div>
            <TextField
              label="Introduction on All Releases page"
              rows={3}
              value={draft.expansion.catalogIntro}
              onChange={(value) =>
                update("expansion", {...draft.expansion, catalogIntro: value})
              }
            />

            <div>
              <p className="field-label">Choose releases for optional pages</p>
              <p className="mt-2 text-xs leading-5 text-muted">
                “List in All Releases” adds a release to the catalog. “Give full
                editorial page” unlocks its release story, lyrics, and Breaking
                Barz annotations even when it is not on the homepage.
              </p>
            </div>
            <div className="space-y-2">
              {(initialRecord?.releaseOptions ?? [])
                .filter((release) => release.catalogScope === "ARTIST")
                .map((release) => {
                  const inCatalog = draft.expansion.catalogReleaseIds.includes(release.id);
                  const editorialEnabledByPlacement =
                    draft.featuredItems.some((item) => item.releaseId === release.id) ||
                    draft.featuredStories.some((item) => item.releaseId === release.id);
                  const editorialEnabled =
                    editorialEnabledByPlacement ||
                    draft.expansion.editorialReleaseIds.includes(release.id);
                  return (
                    <div
                      className="grid gap-3 rounded-lg border border-edge px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      key={release.id}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{release.title}</p>
                        <p className="text-xs text-muted">/{release.slug}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-secondary">
                        <input
                          checked={inCatalog}
                          onChange={(event) => {
                            const nextIds = event.target.checked
                              ? [...draft.expansion.catalogReleaseIds, release.id]
                              : draft.expansion.catalogReleaseIds.filter((id) => id !== release.id);
                            update("expansion", {
                              ...draft.expansion,
                              catalogReleaseIds: nextIds
                            });
                          }}
                          type="checkbox"
                        />
                        List in All Releases
                      </label>
                      <label className="flex items-center gap-2 text-sm text-secondary">
                        <input
                          checked={editorialEnabled}
                          disabled={editorialEnabledByPlacement}
                          onChange={(event) => {
                            const nextIds = event.target.checked
                              ? [...draft.expansion.editorialReleaseIds, release.id]
                              : draft.expansion.editorialReleaseIds.filter((id) => id !== release.id);
                            update("expansion", {
                              ...draft.expansion,
                              editorialReleaseIds: nextIds
                            });
                          }}
                          type="checkbox"
                        />
                        {editorialEnabledByPlacement
                          ? "Editorial page included via homepage"
                          : "Give full editorial page"}
                      </label>
                    </div>
                  );
                })}
              {initialRecord &&
              !initialRecord.releaseOptions.some(
                (release) => release.catalogScope === "ARTIST"
              ) ? (
                <p className="rounded-lg border border-edge px-4 py-3 text-sm text-muted">
                  No managed releases yet. Create one above, or promote an
                  existing homepage release, before configuring these optional
                  pages.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-edge bg-input p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <label className="flex max-w-xl items-start gap-3 text-sm text-secondary">
                <input
                  checked={draft.expansion.featuredStoriesEnabled}
                  className="mt-1"
                  onChange={(event) =>
                    update("expansion", {
                      ...draft.expansion,
                      featuredStoriesEnabled: event.target.checked
                    })
                  }
                  type="checkbox"
                />
                <span>
                  <strong className="block text-ink">
                    Show a Featured Stories section on the profile
                  </strong>
                  Publishes a second profile collection for selected editorial
                  deep dives. Use this when multiple releases deserve priority,
                  without changing the single Start Here release.
                </span>
              </label>
              <button
                className="action-button-secondary"
                onClick={() =>
                  update("featuredStories", [...draft.featuredStories, emptyItem()])
                }
                type="button"
              >
                Add story card
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Section label"
                value={draft.expansion.featuredStoriesLabel}
                onChange={(value) =>
                  update("expansion", {
                    ...draft.expansion,
                    featuredStoriesLabel: value
                  })
                }
              />
              <Field
                label="Section heading"
                value={draft.expansion.featuredStoriesHeading}
                onChange={(value) =>
                  update("expansion", {
                    ...draft.expansion,
                    featuredStoriesHeading: value
                  })
                }
              />
            </div>

            {draft.featuredStories.map((item, index) => (
              <div className="space-y-4 rounded-lg border border-edge p-4" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Editorial release"
                    onChange={(value) => {
                      const selectedRelease = initialRecord?.releaseOptions.find(
                        (release) => release.id === value
                      );
                      update(
                        "featuredStories",
                        draft.featuredStories.map((entry, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...entry,
                                releaseId: value || undefined,
                                title: entry.title || selectedRelease?.title || ""
                              }
                            : entry
                        )
                      );
                    }}
                    options={[
                      {label: "External link only", value: ""},
                      ...(initialRecord?.releaseOptions ?? [])
                        .filter((release) => release.catalogScope === "ARTIST")
                        .map((release) => ({
                          label: release.title,
                          value: release.id
                        }))
                    ]}
                    value={item.releaseId || ""}
                  />
                  <Field
                    label="Eyebrow"
                    value={item.eyebrow}
                    onChange={(value) =>
                      update(
                        "featuredStories",
                        draft.featuredStories.map((entry, itemIndex) =>
                          itemIndex === index ? {...entry, eyebrow: value} : entry
                        )
                      )
                    }
                  />
                  <Field
                    label="Title"
                    value={item.title}
                    onChange={(value) =>
                      update(
                        "featuredStories",
                        draft.featuredStories.map((entry, itemIndex) =>
                          itemIndex === index ? {...entry, title: value} : entry
                        )
                      )
                    }
                  />
                  <Field
                    label="Subtitle"
                    value={item.subtitle}
                    onChange={(value) =>
                      update(
                        "featuredStories",
                        draft.featuredStories.map((entry, itemIndex) =>
                          itemIndex === index ? {...entry, subtitle: value} : entry
                        )
                      )
                    }
                  />
                  <Field
                    label={item.releaseId ? "Fallback destination URL" : "Destination URL"}
                    value={item.url}
                    onChange={(value) =>
                      update(
                        "featuredStories",
                        draft.featuredStories.map((entry, itemIndex) =>
                          itemIndex === index ? {...entry, url: value} : entry
                        )
                      )
                    }
                  />
                  <ImageSourceField
                    id={`artist-featured-story-image-${index}`}
                    label="Story artwork"
                    uploading={uploadingImage === `featured-story-${index}`}
                    value={item.coverArtUrl}
                    onChange={(value) =>
                      update(
                        "featuredStories",
                        draft.featuredStories.map((entry, itemIndex) =>
                          itemIndex === index ? {...entry, coverArtUrl: value} : entry
                        )
                      )
                    }
                    onUpload={(file) =>
                      uploadImage(`featured-story-${index}`, file, (url) =>
                        update(
                          "featuredStories",
                          draft.featuredStories.map((entry, itemIndex) =>
                            itemIndex === index ? {...entry, coverArtUrl: url} : entry
                          )
                        )
                      )
                    }
                  />
                </div>
                <TextField
                  label="Story card description"
                  rows={2}
                  value={item.description}
                  onChange={(value) =>
                    update(
                      "featuredStories",
                      draft.featuredStories.map((entry, itemIndex) =>
                        itemIndex === index ? {...entry, description: value} : entry
                      )
                    )
                  }
                />
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    className="text-sm text-muted hover:text-ink"
                    disabled={index === 0}
                    onClick={() =>
                      update(
                        "featuredStories",
                        moveEntry(draft.featuredStories, index, index - 1)
                      )
                    }
                    type="button"
                  >
                    Move up
                  </button>
                  <button
                    className="text-sm text-muted hover:text-ink"
                    disabled={index === draft.featuredStories.length - 1}
                    onClick={() =>
                      update(
                        "featuredStories",
                        moveEntry(draft.featuredStories, index, index + 1)
                      )
                    }
                    type="button"
                  >
                    Move down
                  </button>
                  <button
                    className="text-sm text-muted hover:text-rose-300"
                    onClick={() =>
                      update(
                        "featuredStories",
                        draft.featuredStories.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    type="button"
                  >
                    Remove story
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="command-surface sticky top-6 space-y-5 p-5 sm:p-6">
          <div className="overflow-hidden rounded-lg border border-edge bg-input">
            <div className="relative aspect-square">
              {draft.profileImagePath ? (
                <Image alt={draft.profileImageAlt || draft.displayName || "Artist"} className="object-cover" fill src={draft.profileImagePath} unoptimized />
              ) : <div className="grid h-full place-items-center text-sm text-muted">No profile image</div>}
            </div>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="status-badge-neutral">{initialRecord?.workflowStatus || "DRAFT"}</span>
              <span className="status-badge-neutral">
                {ARTIST_THEME_FAMILIES.find((theme) => theme.value === draft.themeFamily)?.label || "Signal Noir"}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-ink">{draft.displayName || "Untitled artist"}</h2>
            <p className="mt-1 text-sm text-muted">/artists/{draft.slug || "slug"}</p>
          </div>

          {message ? <p className="rounded-lg border border-edge bg-input px-4 py-3 text-sm text-secondary">{message}</p> : null}

          <button className="action-button-primary w-full justify-center" disabled={Boolean(busy)} onClick={save} type="button">
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>

          {initialRecord ? (
            <div className="space-y-4 border-t border-edge pt-5">
              <div>
                <p className="field-label">Approval-safe publishing</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Generate a frozen private preview after saving. Later edits will not change that version.
                </p>
              </div>
              <button className="action-button-secondary w-full justify-center" disabled={Boolean(busy)} onClick={createPreview} type="button">
                {busy === "preview" ? "Creating…" : "Create private preview"}
              </button>
              {previewUrl ? (
                <div className="space-y-2 rounded-lg border border-edge bg-input p-4">
                  <label className="field-label block" htmlFor="artist-preview-url">Shareable review URL</label>
                  <input className="field-input text-xs" id="artist-preview-url" readOnly value={previewUrl} />
                  <button
                    className="action-button-secondary w-full justify-center"
                    onClick={async () => {
                      await navigator.clipboard.writeText(previewUrl);
                      setMessage("Private review link copied.");
                    }}
                    type="button"
                  >
                    Copy review link
                  </button>
                </div>
              ) : null}
              {latestVersion ? (
                <div className="space-y-3 rounded-lg border border-edge bg-input p-4">
                  <p className="text-sm font-semibold text-ink">Version {latestVersion.version}</p>
                  <p className="text-xs text-muted">{latestVersion.approvalStatus}</p>
                  {latestVersion.previewExpiresAt &&
                  !latestVersion.previewRevokedAt &&
                  !latestVersion.previewSupersededAt ? (
                    <p className="text-xs text-muted">
                      Review link expires{" "}
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      }).format(new Date(latestVersion.previewExpiresAt))}
                    </p>
                  ) : null}
                  {latestVersion.previewSupersededAt ? (
                    <p className="text-xs text-amber-300">Review link superseded</p>
                  ) : null}
                  {latestVersion.previewRevokedAt ? (
                    <p className="text-xs text-amber-300">Review link revoked</p>
                  ) : null}
                  {latestVersion.previewIsExpired ? (
                    <p className="text-xs text-amber-300">Review link expired</p>
                  ) : null}
                  {latestVersion.approvalStatus === "AWAITING_APPROVAL" &&
                  !latestVersion.previewIsExpired ? (
                    <>
                      <Field label="Approver email (optional)" type="email" value={approvalEmail} onChange={setApprovalEmail} />
                      <button className="action-button-secondary w-full justify-center" disabled={Boolean(busy)} onClick={approve} type="button">
                        {busy === "approve" ? "Recording…" : "Confirm off-platform approval"}
                      </button>
                    </>
                  ) : null}
                  {latestVersion.approval ? (
                    <div className="rounded-md border border-edge bg-surface p-3 text-xs leading-5 text-muted">
                      <p className="font-semibold text-secondary">
                        {latestVersion.approval.decidedByEmail
                          ? `Approved by ${latestVersion.approval.decidedByEmail}`
                          : "Approval confirmed by an authenticated administrator"}
                      </p>
                      <p>
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        }).format(new Date(latestVersion.approval.decidedAt))}
                      </p>
                      {latestVersion.approval.notes ? (
                        <p className="mt-1">{latestVersion.approval.notes}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {latestVersion.approvalStatus === "APPROVED" &&
                  !latestVersion.publishedAt ? (
                    <button className="action-button-primary w-full justify-center" disabled={Boolean(busy)} onClick={publish} type="button">
                      {busy === "publish" ? "Publishing…" : "Publish approved version"}
                    </button>
                  ) : null}
                  {latestVersion.publishedAt ? (
                    <div className="state-panel-success">
                      Version {latestVersion.version} published{" "}
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      }).format(new Date(latestVersion.publishedAt))}
                    </div>
                  ) : null}
                  {!latestVersion.previewRevokedAt &&
                  !latestVersion.previewSupersededAt &&
                  !latestVersion.previewIsExpired &&
                  !latestVersion.publishedAt ? (
                    <button
                      className="action-button-secondary w-full justify-center"
                      disabled={Boolean(busy)}
                      onClick={revokePreview}
                      type="button"
                    >
                      {busy === "revoke" ? "Revoking…" : "Revoke review link"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  maxLength
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="field-label mb-2 block">{label}</span>
      <input className="field-input" maxLength={maxLength} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function ImageSourceField({
  id,
  label,
  value,
  uploading,
  onChange,
  onUpload
}: {
  id: string;
  label: string;
  value: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <Field label={`${label} URL`} value={value} onChange={onChange} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="action-button-secondary cursor-pointer" htmlFor={id}>
          {uploading ? "Uploading…" : "Upload image"}
        </label>
        <span className="text-xs text-muted">Paste an HTTPS URL or upload JPG, PNG, or WebP.</span>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={uploading}
        id={id}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.currentTarget.value = "";
        }}
        type="file"
      />
    </div>
  );
}

function TextField({label, value, onChange, rows}: {label: string; value: string; onChange: (value: string) => void; rows: number}) {
  return (
    <label className="block">
      <span className="field-label mb-2 block">{label}</span>
      <textarea className="field-input resize-y" onChange={(event) => onChange(event.target.value)} rows={rows} value={value} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{label: string; value: string}>;
}) {
  return (
    <label className="block">
      <span className="field-label mb-2 block">{label}</span>
      <select
        className="field-input"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value || "external"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
