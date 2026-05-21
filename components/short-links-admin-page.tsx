"use client";

import {useEffect, useMemo, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {Check, Copy, ExternalLink, Link2, Trash2} from "lucide-react";

import {
  createShortLinkAction,
  deleteShortLinkAction,
  updateShortLinkContextAction
} from "@/app/admin/(protected)/short-links/actions";
import {
  buildDestinationUrlWithUtm,
  utmMediumPresets,
  utmSourcePresets,
  type UtmFields
} from "@/lib/short-link-url";
import type {ReleaseSummary, ShortLinkRecord} from "@/lib/types";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function getShortUrl(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/+$/g, "")}/p/${slug}`;
}

type ShortLinkContextDraft = {
  releaseId: string;
  campaignLabel: string;
  contentLabel: string;
};

function createContextDrafts(links: ShortLinkRecord[]) {
  return Object.fromEntries(
    links.map((link) => [
      link.id,
      {
        campaignLabel: link.campaign_label,
        contentLabel: link.content_label,
        releaseId: link.release_id
      }
    ])
  ) as Record<string, ShortLinkContextDraft>;
}

export function ShortLinksAdminPage({
  baseUrl,
  initialLinks,
  releaseOptions
}: {
  baseUrl: string;
  initialLinks: ShortLinkRecord[];
  releaseOptions: ReleaseSummary[];
}) {
  const router = useRouter();
  const [destinationUrl, setDestinationUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [contentLabel, setContentLabel] = useState("");
  const [utmFields, setUtmFields] = useState<UtmFields>({});
  const [contextDrafts, setContextDrafts] = useState(() =>
    createContextDrafts(initialLinks)
  );
  const [copiedSlug, setCopiedSlug] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const finalDestinationPreview = useMemo(() => {
    if (!destinationUrl.trim()) {
      return "";
    }

    try {
      return buildDestinationUrlWithUtm(destinationUrl, utmFields);
    } catch {
      return "";
    }
  }, [destinationUrl, utmFields]);

  useEffect(() => {
    setContextDrafts(createContextDrafts(initialLinks));
  }, [initialLinks]);

  function updateUtmField(key: keyof UtmFields, value: string) {
    setUtmFields((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleCreate() {
    setMessage("");
    startTransition(async () => {
      const result = await createShortLinkAction({
        campaignLabel,
        contentLabel,
        customSlug,
        destinationUrl,
        releaseId,
        utmFields
      });

      setMessage(result.message);

      if (result.ok && result.link) {
        setDestinationUrl("");
        setCustomSlug("");
        setReleaseId("");
        setCampaignLabel("");
        setContentLabel("");
        setUtmFields({});
        await navigator.clipboard?.writeText(getShortUrl(baseUrl, result.link.slug));
        setCopiedSlug(result.link.slug);
        router.refresh();
      }
    });
  }

  function updateContextDraft(
    linkId: string,
    key: keyof ShortLinkContextDraft,
    value: string
  ) {
    setContextDrafts((current) => ({
      ...current,
      [linkId]: {
        ...(current[linkId] ?? {
          campaignLabel: "",
          contentLabel: "",
          releaseId: ""
        }),
        [key]: value
      }
    }));
  }

  function handleSaveContext(link: ShortLinkRecord) {
    const draft = contextDrafts[link.id] ?? {
      campaignLabel: link.campaign_label,
      contentLabel: link.content_label,
      releaseId: link.release_id
    };

    setMessage("");
    startTransition(async () => {
      const result = await updateShortLinkContextAction({
        campaignLabel: draft.campaignLabel,
        contentLabel: draft.contentLabel,
        id: link.id,
        releaseId: draft.releaseId
      });

      setMessage(result.message);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleDelete(link: ShortLinkRecord) {
    const confirmed = window.confirm(
      `Delete ${getShortUrl(baseUrl, link.slug)}?\n\nThis only soft-deletes the short link. It will stop redirecting, but the slug will not be reused automatically.`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    startTransition(async () => {
      const result = await deleteShortLinkAction(link.id);

      setMessage(result.message);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  async function handleCopy(slug: string) {
    await navigator.clipboard.writeText(getShortUrl(baseUrl, slug));
    setCopiedSlug(slug);
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="panel px-4 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">Utility links</div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Short Links
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Turn long pre-save, campaign, or destination URLs into branded
                `vvviruz.com/p/...` links.
              </p>
            </div>
            <div className="rounded-full border border-[#30343b] bg-[#101216] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {initialLinks.length} active
            </div>
          </div>
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_auto] lg:items-end">
            <label className="block">
              <span className="field-label">Destination URL</span>
              <input
                className="field-input mt-2"
                onChange={(event) => setDestinationUrl(event.target.value)}
                placeholder="https://distrokid.com/hyperfollow/..."
                type="url"
                value={destinationUrl}
              />
            </label>

            <label className="block">
              <span className="field-label">Custom slug optional</span>
              <input
                className="field-input mt-2"
                onChange={(event) => setCustomSlug(event.target.value)}
                placeholder="mad-bunny-presave"
                value={customSlug}
              />
            </label>

            <button
              className="action-button-primary justify-center"
              disabled={isPending}
              onClick={handleCreate}
              type="button"
            >
              <Link2 size={16} />
              {isPending ? "Working..." : "Shorten"}
            </button>
          </div>

          <div className="rounded-[24px] border border-[#30343b] bg-[#101216] p-4">
            <p className="field-label">Attribution handoff</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Optional context lets Attribution connect short-link clicks back to a
              release, campaign, or creative label without adding another analytics
              surface here.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="field-label">Release</span>
                <select
                  className="field-input mt-2"
                  onChange={(event) => setReleaseId(event.target.value)}
                  value={releaseId}
                >
                  <option value="">Standalone / no release</option>
                  {releaseOptions.map((release) => (
                    <option key={release.id} value={release.id}>
                      {release.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="field-label">Campaign Label</span>
                <input
                  className="field-input mt-2"
                  onChange={(event) => setCampaignLabel(event.target.value)}
                  placeholder="Mad Bunny rollout"
                  value={campaignLabel}
                />
              </label>

              <label className="block">
                <span className="field-label">Content Label</span>
                <input
                  className="field-input mt-2"
                  onChange={(event) => setContentLabel(event.target.value)}
                  placeholder="AMV hook test"
                  value={contentLabel}
                />
              </label>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#30343b] bg-[#101216] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="field-label">UTM Presets</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Optional tracking values are appended to the destination before
                  saving. Existing query parameters are preserved, and any filled UTM
                  field overwrites that same UTM key cleanly.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-[20px] border border-[#3b3322] bg-[#17140d] p-4 text-sm leading-6 text-[#d7c48f] md:grid-cols-2">
              <p>
                <span className="font-semibold text-[#f1dfad]">Source</span> is where
                traffic comes from, like `meta`, `instagram`, or `email`.
              </p>
              <p>
                <span className="font-semibold text-[#f1dfad]">Medium</span> is the
                traffic lane, like `paid_social`, `bio_link`, or `organic_social`.
              </p>
              <p>
                <span className="font-semibold text-[#f1dfad]">Campaign</span> should
                usually be the release or rollout name, like `mad_bunny`.
              </p>
              <p>
                <span className="font-semibold text-[#f1dfad]">Content</span> should
                match the ad or creative name when possible, like `mad_bunny_amv_v1`.
              </p>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">utm_source</span>
                  <input
                    className="field-input mt-2"
                    onChange={(event) => updateUtmField("utm_source", event.target.value)}
                    placeholder="meta"
                    value={utmFields.utm_source ?? ""}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {utmSourcePresets.map((preset) => (
                    <button
                      className="rounded-full border border-[#30343b] bg-[#15181d] px-3 py-1.5 text-xs font-semibold text-[#d9dee5] transition hover:border-accent/50 hover:text-[#f1dfad]"
                      key={preset}
                      onClick={() => updateUtmField("utm_source", preset)}
                      type="button"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">utm_medium</span>
                  <input
                    className="field-input mt-2"
                    onChange={(event) => updateUtmField("utm_medium", event.target.value)}
                    placeholder="paid_social"
                    value={utmFields.utm_medium ?? ""}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {utmMediumPresets.map((preset) => (
                    <button
                      className="rounded-full border border-[#30343b] bg-[#15181d] px-3 py-1.5 text-xs font-semibold text-[#d9dee5] transition hover:border-accent/50 hover:text-[#f1dfad]"
                      key={preset}
                      onClick={() => updateUtmField("utm_medium", preset)}
                      type="button"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="field-label">utm_campaign</span>
                <input
                  className="field-input mt-2"
                  onChange={(event) => updateUtmField("utm_campaign", event.target.value)}
                  placeholder="mad_bunny"
                  value={utmFields.utm_campaign ?? ""}
                />
              </label>

              <label className="block">
                <span className="field-label">utm_content</span>
                <input
                  className="field-input mt-2"
                  onChange={(event) => updateUtmField("utm_content", event.target.value)}
                  placeholder="mad_bunny_ad_1"
                  value={utmFields.utm_content ?? ""}
                />
              </label>

              <label className="block xl:col-span-2">
                <span className="field-label">utm_term</span>
                <input
                  className="field-input mt-2"
                  onChange={(event) => updateUtmField("utm_term", event.target.value)}
                  placeholder="optional keyword or audience"
                  value={utmFields.utm_term ?? ""}
                />
              </label>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#30343b] bg-[#0d0f12] px-4 py-3">
            <p className="field-label">Final destination preview</p>
            <p className="mt-2 break-all text-sm leading-6 text-muted">
              {finalDestinationPreview ||
                (destinationUrl.trim()
                  ? "Enter a valid http:// or https:// destination to preview the final URL."
                  : "Add a destination URL to preview the final tracked destination.")}
            </p>
          </div>

          {message ? (
            <p className="mt-4 rounded-[18px] border border-[#30343b] bg-[#101216] px-4 py-3 text-sm text-ink">
              {message}
            </p>
          ) : null}
        </section>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-[#30343b] px-4 py-5 sm:px-6">
            <p className="field-label">Management</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Active short links</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-[#171a1f] text-[#b8bec6]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Short URL</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Attribution Context</th>
                  <th className="px-4 py-3 font-semibold">Clicks</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31]">
                {initialLinks.length > 0 ? (
                  initialLinks.map((link) => {
                    const shortUrl = getShortUrl(baseUrl, link.slug);
                    const isCopied = copiedSlug === link.slug;
                    const draft = contextDrafts[link.id] ?? {
                      campaignLabel: link.campaign_label,
                      contentLabel: link.content_label,
                      releaseId: link.release_id
                    };

                    return (
                      <tr className="align-top text-[#d9dee5]" key={link.id}>
                        <td className="px-4 py-4">
                          <a
                            className="font-semibold text-[#f1dfad] transition hover:text-[#d7b45e]"
                            href={shortUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {shortUrl}
                          </a>
                        </td>
                        <td className="max-w-[420px] px-4 py-4">
                          <p className="break-all text-muted">{link.destination_url}</p>
                        </td>
                        <td className="min-w-[320px] px-4 py-4">
                          <div className="space-y-2">
                            <p className="font-semibold text-ink">
                              {link.release_title || "Standalone"}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {link.campaign_label ? (
                                <span className="pill">Campaign: {link.campaign_label}</span>
                              ) : null}
                              {link.content_label ? (
                                <span className="pill">Content: {link.content_label}</span>
                              ) : null}
                              {!link.campaign_label && !link.content_label ? (
                                <span className="text-muted">No campaign/content labels</span>
                              ) : null}
                            </div>
                            <details className="rounded-[18px] border border-[#30343b] bg-[#0f1114] p-3">
                              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[#f1dfad]">
                                Edit context
                              </summary>
                              <div className="mt-3 grid gap-3">
                                <label className="block">
                                  <span className="field-label">Release</span>
                                  <select
                                    className="field-input mt-2"
                                    onChange={(event) =>
                                      updateContextDraft(
                                        link.id,
                                        "releaseId",
                                        event.target.value
                                      )
                                    }
                                    value={draft.releaseId}
                                  >
                                    <option value="">Standalone / no release</option>
                                    {releaseOptions.map((release) => (
                                      <option key={release.id} value={release.id}>
                                        {release.title}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="field-label">Campaign Label</span>
                                  <input
                                    className="field-input mt-2"
                                    onChange={(event) =>
                                      updateContextDraft(
                                        link.id,
                                        "campaignLabel",
                                        event.target.value
                                      )
                                    }
                                    value={draft.campaignLabel}
                                  />
                                </label>
                                <label className="block">
                                  <span className="field-label">Content Label</span>
                                  <input
                                    className="field-input mt-2"
                                    onChange={(event) =>
                                      updateContextDraft(
                                        link.id,
                                        "contentLabel",
                                        event.target.value
                                      )
                                    }
                                    value={draft.contentLabel}
                                  />
                                </label>
                                <button
                                  className="action-button-secondary justify-center px-3 py-2"
                                  disabled={isPending}
                                  onClick={() => handleSaveContext(link)}
                                  type="button"
                                >
                                  Save Context
                                </button>
                              </div>
                            </details>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-ink">{link.click_count}</td>
                        <td className="px-4 py-4 text-muted">{formatDate(link.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="action-button-secondary px-3 py-2"
                              onClick={() => void handleCopy(link.slug)}
                              type="button"
                            >
                              {isCopied ? <Check size={15} /> : <Copy size={15} />}
                              {isCopied ? "Copied" : "Copy"}
                            </button>
                            <a
                              className="action-button-secondary px-3 py-2"
                              href={shortUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <ExternalLink size={15} />
                              Open
                            </a>
                            <button
                              className="rounded-full border border-[#7b3e3e] bg-[#341919] px-3 py-2 text-sm font-semibold text-[#f0d7d2] transition hover:border-[#9a5656] hover:bg-[#452020]"
                              onClick={() => handleDelete(link)}
                              type="button"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted" colSpan={6}>
                      No active short links yet. Paste a destination URL above to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
