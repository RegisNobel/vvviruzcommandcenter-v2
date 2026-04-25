"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Mail,
  MailPlus,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  UserMinus,
  UserPlus,
  Users
} from "lucide-react";

import type {
  AudienceFilter,
  AudienceOverview,
  EmailCampaignRecord,
  EmailCampaignStatus,
  EmailSendLogRecord,
  SubscriberRecord,
  SubscriberSource,
  SubscriberStatus,
  SiteSettingsRecord
} from "@/lib/types";

type ExclusiveOfferSettings = SiteSettingsRecord["site_content"]["exclusive"];

type AudienceAdminPageProps = {
  initialOverview: AudienceOverview;
  initialSubscribers: SubscriberRecord[];
  initialExclusiveOffer: ExclusiveOfferSettings;
  initialCampaigns: EmailCampaignRecord[];
  initialSendLogs: EmailSendLogRecord[];
  initialTrackFileOptions: string[];
  initialTrackArtOptions: string[];
};

type SubscriberDraft = {
  id: string | null;
  name: string;
  email: string;
  source: SubscriberSource;
  status: SubscriberStatus;
  consent_given: boolean;
};

type CampaignDraft = {
  id: string | null;
  subject: string;
  preview_text: string;
  body: string;
  cta_label: string;
  cta_url: string;
  audience_filter: AudienceFilter;
  recipient_count: number;
  status: EmailCampaignStatus;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const subscriberStatusOptions: Array<{label: string; value: SubscriberStatus | "all"}> = [
  {label: "All", value: "all"},
  {label: "Active", value: "active"},
  {label: "Unsubscribed", value: "unsubscribed"}
];

const audienceFilterOptions: Array<{label: string; value: AudienceFilter}> = [
  {label: "All active subscribers", value: "all_active"},
  {label: "Exclusive signup subscribers", value: "exclusive_source"},
  {label: "Manual subscribers", value: "manual_source"}
];

function createEmptySubscriberDraft(): SubscriberDraft {
  return {
    id: null,
    name: "",
    email: "",
    source: "manual",
    status: "active",
    consent_given: false
  };
}

function createEmptyCampaignDraft(): CampaignDraft {
  return {
    id: null,
    subject: "",
    preview_text: "",
    body: "",
    cta_label: "",
    cta_url: "",
    audience_filter: "all_active",
    recipient_count: 0,
    status: "draft"
  };
}

function toCampaignDraft(campaign: EmailCampaignRecord): CampaignDraft {
  return {
    id: campaign.id,
    subject: campaign.subject,
    preview_text: campaign.preview_text,
    body: campaign.body,
    cta_label: campaign.cta_label,
    cta_url: campaign.cta_url,
    audience_filter: campaign.audience_filter,
    recipient_count: campaign.recipient_count,
    status: campaign.status
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatShortDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatSourceLabel(source: SubscriberSource) {
  return source === "exclusive" ? "Exclusive" : "Manual";
}

function formatAudienceFilter(value: AudienceFilter) {
  return audienceFilterOptions.find((option) => option.value === value)?.label ?? value;
}

function formatCampaignStatus(value: EmailCampaignStatus) {
  switch (value) {
    case "draft":
      return "Draft";
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    default:
      return value;
  }
}

function getStatusPillClass(status: EmailCampaignStatus | SubscriberStatus) {
  if (status === "sent" || status === "active") {
    return "border border-emerald-500/25 bg-emerald-500/12 text-emerald-200";
  }

  if (status === "sending") {
    return "border border-[#5b4920] bg-[#1a1710] text-[#d7b45e]";
  }

  if (status === "failed" || status === "unsubscribed") {
    return "border border-rose-500/25 bg-rose-500/12 text-rose-200";
  }

  return "border border-[#31353b] bg-[#15181c] text-[#d5d9df]";
}

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

export function AudienceAdminPage({
  initialOverview,
  initialSubscribers,
  initialExclusiveOffer,
  initialCampaigns,
  initialSendLogs,
  initialTrackFileOptions,
  initialTrackArtOptions
}: AudienceAdminPageProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [subscribers, setSubscribers] = useState(initialSubscribers);
  const [exclusiveOffer, setExclusiveOffer] = useState(initialExclusiveOffer);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [sendLogs, setSendLogs] = useState(initialSendLogs);
  const [trackFileOptions, setTrackFileOptions] = useState(initialTrackFileOptions);
  const [trackArtOptions, setTrackArtOptions] = useState(initialTrackArtOptions);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<
    SubscriberStatus | "all"
  >("all");
  const [subscriberDraft, setSubscriberDraft] = useState<SubscriberDraft>(
    createEmptySubscriberDraft()
  );
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(() => {
    const firstDraft = initialCampaigns.find((campaign) => campaign.status === "draft");

    return firstDraft ? toCampaignDraft(firstDraft) : createEmptyCampaignDraft();
  });
  const [subscriberSaveState, setSubscriberSaveState] = useState<SaveState>("idle");
  const [offerSaveState, setOfferSaveState] = useState<SaveState>("idle");
  const [campaignSaveState, setCampaignSaveState] = useState<SaveState>("idle");
  const [subscriberMessage, setSubscriberMessage] = useState<string | null>(null);
  const [offerMessage, setOfferMessage] = useState<string | null>(null);
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);
  const [isRefreshingSubscribers, setIsRefreshingSubscribers] = useState(false);
  const [isRefreshingCampaigns, setIsRefreshingCampaigns] = useState(false);
  const [trackUploadFile, setTrackUploadFile] = useState<File | null>(null);
  const [artUploadFile, setArtUploadFile] = useState<File | null>(null);
  const [isUploadingTrack, setIsUploadingTrack] = useState(false);
  const [isUploadingArt, setIsUploadingArt] = useState(false);

  const selectedCampaignRecord = useMemo(
    () =>
      campaignDraft.id
        ? campaigns.find((campaign) => campaign.id === campaignDraft.id) ?? null
        : null,
    [campaignDraft.id, campaigns]
  );
  const campaignIsPersisted = Boolean(selectedCampaignRecord);
  const campaignIsLocked =
    selectedCampaignRecord?.status === "sent" || selectedCampaignRecord?.status === "sending";
  const campaignHistory = useMemo(
    () => campaigns.filter((campaign) => campaign.status !== "draft"),
    [campaigns]
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns]
  );

  const refreshSubscribers = useCallback(async (
    nextSearch = subscriberSearch,
    nextStatus = subscriberStatusFilter
  ) => {
    setIsRefreshingSubscribers(true);

    try {
      const query = new URLSearchParams();

      if (nextSearch.trim()) {
        query.set("search", nextSearch.trim());
      }

      query.set("status", nextStatus);

      const payload = await readJson<{
        subscribers: SubscriberRecord[];
        overview: AudienceOverview;
      }>(`/api/subscribers?${query.toString()}`);

      setSubscribers(payload.subscribers);
      setOverview(payload.overview);
    } catch (error) {
      setSubscriberMessage(
        error instanceof Error ? error.message : "Unable to load subscribers."
      );
      setSubscriberSaveState("error");
    } finally {
      setIsRefreshingSubscribers(false);
    }
  }, [subscriberSearch, subscriberStatusFilter]);

  const refreshCampaigns = useCallback(async () => {
    setIsRefreshingCampaigns(true);

    try {
      const payload = await readJson<{
        campaigns: EmailCampaignRecord[];
        sendLogs: EmailSendLogRecord[];
      }>("/api/campaigns");

      setCampaigns(payload.campaigns);
      setSendLogs(payload.sendLogs);

      if (campaignDraft.id) {
        const refreshedCampaign = payload.campaigns.find(
          (campaign) => campaign.id === campaignDraft.id
        );

        if (refreshedCampaign) {
          setCampaignDraft(toCampaignDraft(refreshedCampaign));
        }
      }
    } catch (error) {
      setCampaignMessage(
        error instanceof Error ? error.message : "Unable to load campaign data."
      );
      setCampaignSaveState("error");
    } finally {
      setIsRefreshingCampaigns(false);
    }
  }, [campaignDraft.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSubscribers(subscriberSearch, subscriberStatusFilter);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [refreshSubscribers, subscriberSearch, subscriberStatusFilter]);

  function beginEditSubscriber(subscriber: SubscriberRecord) {
    setSubscriberDraft({
      id: subscriber.id,
      name: subscriber.name,
      email: subscriber.email,
      source: subscriber.source,
      status: subscriber.status,
      consent_given: subscriber.consent_given
    });
    setSubscriberMessage(null);
    setSubscriberSaveState("idle");
  }

  function resetSubscriberDraft() {
    setSubscriberDraft(createEmptySubscriberDraft());
  }

  async function handleSubscriberSave() {
    setSubscriberSaveState("saving");
    setSubscriberMessage(null);

    try {
      if (subscriberDraft.id) {
        await readJson<{subscriber: SubscriberRecord; message: string}>(
          `/api/subscribers/${subscriberDraft.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(subscriberDraft)
          }
        );
      } else {
        await readJson<{subscriber: SubscriberRecord; message: string}>("/api/subscribers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(subscriberDraft)
        });
      }

      await refreshSubscribers();
      setSubscriberSaveState("saved");
      setSubscriberMessage(
        subscriberDraft.id ? "Subscriber updated." : "Subscriber added."
      );
      resetSubscriberDraft();
    } catch (error) {
      setSubscriberSaveState("error");
      setSubscriberMessage(
        error instanceof Error ? error.message : "Unable to save subscriber."
      );
    }
  }

  async function handleSubscriberDelete(subscriber: SubscriberRecord) {
    const shouldDelete = window.confirm(
      `Delete ${subscriber.email}? This removes the subscriber record permanently.`
    );

    if (!shouldDelete) {
      return;
    }

    setSubscriberMessage(null);
    setSubscriberSaveState("saving");

    try {
      await readJson<{message: string}>(`/api/subscribers/${subscriber.id}`, {
        method: "DELETE"
      });
      await refreshSubscribers();

      if (subscriberDraft.id === subscriber.id) {
        resetSubscriberDraft();
      }

      setSubscriberSaveState("saved");
      setSubscriberMessage("Subscriber deleted.");
    } catch (error) {
      setSubscriberSaveState("error");
      setSubscriberMessage(
        error instanceof Error ? error.message : "Unable to delete subscriber."
      );
    }
  }

  async function handleSubscriberUnsubscribe(subscriber: SubscriberRecord) {
    const shouldUnsubscribe = window.confirm(
      `Mark ${subscriber.email} as unsubscribed? They will no longer receive campaigns.`
    );

    if (!shouldUnsubscribe) {
      return;
    }

    setSubscriberMessage(null);
    setSubscriberSaveState("saving");

    try {
      await readJson<{subscriber: SubscriberRecord; message: string}>(
        `/api/subscribers/${subscriber.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...subscriber,
            unsubscribe: true,
            consent_given: subscriber.consent_given
          })
        }
      );
      await refreshSubscribers();
      setSubscriberSaveState("saved");
      setSubscriberMessage("Subscriber unsubscribed.");
    } catch (error) {
      setSubscriberSaveState("error");
      setSubscriberMessage(
        error instanceof Error ? error.message : "Unable to unsubscribe subscriber."
      );
    }
  }

  async function handleOfferSave() {
    setOfferSaveState("saving");
    setOfferMessage(null);

    try {
      const payload = await readJson<{
        exclusive: ExclusiveOfferSettings;
        message: string;
      }>("/api/exclusive/offer", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(exclusiveOffer)
      });

      setExclusiveOffer(payload.exclusive);
      setOfferSaveState("saved");
      setOfferMessage(payload.message ?? "Exclusive offer saved.");
    } catch (error) {
      setOfferSaveState("error");
      setOfferMessage(error instanceof Error ? error.message : "Unable to save offer.");
    }
  }

  async function handleUploadAsset(assetType: "track" | "art") {
    const file = assetType === "track" ? trackUploadFile : artUploadFile;

    if (!file) {
      setOfferSaveState("error");
      setOfferMessage(
        assetType === "track"
          ? "Choose a track file first."
          : "Choose an artwork file first."
      );

      return;
    }

    if (assetType === "track") {
      setIsUploadingTrack(true);
    } else {
      setIsUploadingArt(true);
    }

    setOfferMessage(null);

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
        setExclusiveOffer((current) => ({
          ...current,
          exclusive_track_file_path: payload.storedPath
        }));
        setTrackUploadFile(null);
      } else {
        const storedFileName = getStoredFileName(payload.storedPath);

        setTrackArtOptions((current) =>
          Array.from(new Set([...current, storedFileName])).sort((left, right) =>
            left.localeCompare(right)
          )
        );
        setExclusiveOffer((current) => ({
          ...current,
          exclusive_track_art_path: payload.publicUrl ?? ""
        }));
        setArtUploadFile(null);
      }

      setOfferSaveState("saved");
      setOfferMessage(
        assetType === "track" ? "Track uploaded." : "Artwork uploaded."
      );
    } catch (error) {
      setOfferSaveState("error");
      setOfferMessage(
        error instanceof Error ? error.message : "Unable to upload the file."
      );
    } finally {
      if (assetType === "track") {
        setIsUploadingTrack(false);
      } else {
        setIsUploadingArt(false);
      }
    }
  }

  async function handleCampaignSave() {
    setCampaignSaveState("saving");
    setCampaignMessage(null);

    try {
      if (campaignDraft.id) {
        const payload = await readJson<{campaign: EmailCampaignRecord; message: string}>(
          `/api/campaigns/${campaignDraft.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(campaignDraft)
          }
        );

        setCampaignDraft(toCampaignDraft(payload.campaign));
      } else {
        const payload = await readJson<{campaign: EmailCampaignRecord; message: string}>(
          "/api/campaigns",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(campaignDraft)
          }
        );

        setCampaignDraft(toCampaignDraft(payload.campaign));
      }

      await refreshCampaigns();
      setCampaignSaveState("saved");
      setCampaignMessage("Campaign draft saved.");
    } catch (error) {
      setCampaignSaveState("error");
      setCampaignMessage(
        error instanceof Error ? error.message : "Unable to save campaign."
      );
    }
  }

  async function handleCampaignDelete() {
    if (!campaignDraft.id) {
      setCampaignDraft(createEmptyCampaignDraft());
      setCampaignMessage("Draft cleared.");
      setCampaignSaveState("idle");

      return;
    }

    const shouldDelete = window.confirm(
      "Delete this campaign draft? Sent campaigns cannot be deleted."
    );

    if (!shouldDelete) {
      return;
    }

    setCampaignSaveState("saving");
    setCampaignMessage(null);

    try {
      await readJson<{message: string}>(`/api/campaigns/${campaignDraft.id}`, {
        method: "DELETE"
      });
      await refreshCampaigns();
      setCampaignDraft(createEmptyCampaignDraft());
      setCampaignSaveState("saved");
      setCampaignMessage("Campaign deleted.");
    } catch (error) {
      setCampaignSaveState("error");
      setCampaignMessage(
        error instanceof Error ? error.message : "Unable to delete campaign."
      );
    }
  }

  async function handleCampaignTestSend() {
    if (!campaignDraft.id) {
      setCampaignSaveState("error");
      setCampaignMessage("Save the campaign draft before sending a test.");

      return;
    }

    setCampaignSaveState("saving");
    setCampaignMessage(null);

    try {
      const payload = await readJson<{message: string}>(
        `/api/campaigns/${campaignDraft.id}/test`,
        {
          method: "POST"
        }
      );

      setCampaignSaveState("saved");
      setCampaignMessage(payload.message ?? "Test email sent.");
    } catch (error) {
      setCampaignSaveState("error");
      setCampaignMessage(
        error instanceof Error ? error.message : "Unable to send test email."
      );
    }
  }

  async function handleCampaignSend() {
    if (!campaignDraft.id) {
      setCampaignSaveState("error");
      setCampaignMessage("Save the campaign draft before sending it.");

      return;
    }

    const shouldSend = window.confirm(
      `Send this campaign to ${campaignDraft.recipient_count} recipient${
        campaignDraft.recipient_count === 1 ? "" : "s"
      }? Active consented subscribers only will be included.`
    );

    if (!shouldSend) {
      return;
    }

    setCampaignSaveState("saving");
    setCampaignMessage(null);

    try {
      const payload = await readJson<{
        campaign: EmailCampaignRecord;
        summary: {
          recipientCount: number;
          sentCount: number;
          failedCount: number;
        };
        message: string;
      }>(`/api/campaigns/${campaignDraft.id}/send`, {
        method: "POST"
      });

      await refreshCampaigns();
      setCampaignDraft(toCampaignDraft(payload.campaign));
      setCampaignSaveState("saved");
      setCampaignMessage(
        `${payload.message} Sent ${payload.summary.sentCount} of ${payload.summary.recipientCount}.`
      );
    } catch (error) {
      setCampaignSaveState("error");
      setCampaignMessage(
        error instanceof Error ? error.message : "Unable to send campaign."
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="panel px-5 py-5">
          <p className="field-label">Total</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{overview.total_subscribers}</p>
          <p className="mt-2 text-sm text-muted">Every captured or manually added contact.</p>
        </div>
        <div className="panel px-5 py-5">
          <p className="field-label">Active</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{overview.active_subscribers}</p>
          <p className="mt-2 text-sm text-muted">Subscribers currently eligible for access.</p>
        </div>
        <div className="panel px-5 py-5">
          <p className="field-label">Consented</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{overview.consented_subscribers}</p>
          <p className="mt-2 text-sm text-muted">Active subscribers eligible for campaigns.</p>
        </div>
        <div className="panel px-5 py-5">
          <p className="field-label">Exclusive</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{overview.exclusive_subscribers}</p>
          <p className="mt-2 text-sm text-muted">Captured through the public exclusive page.</p>
        </div>
        <div className="panel px-5 py-5">
          <p className="field-label">Manual</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{overview.manual_subscribers}</p>
          <p className="mt-2 text-sm text-muted">Subscribers added from the command center.</p>
        </div>
        <div className="panel px-5 py-5">
          <p className="field-label">Unsubscribed</p>
          <p className="mt-3 text-3xl font-semibold text-ink">
            {overview.unsubscribed_subscribers}
          </p>
          <p className="mt-2 text-sm text-muted">Never mailed by campaign sends.</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <Users size={12} />
                Subscribers
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Audience management</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Search, edit, unsubscribe, delete, or manually add subscribers without
                leaving the page.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="action-button-secondary"
                onClick={() => {
                  window.location.href = "/api/subscribers/export";
                }}
                type="button"
              >
                <Download size={16} />
                Export CSV
              </button>
              <button
                className="action-button-secondary"
                onClick={() => void refreshSubscribers()}
                type="button"
              >
                <RefreshCw className={isRefreshingSubscribers ? "animate-spin" : ""} size={16} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="space-y-2">
              <span className="field-label">Search by name or email</span>
              <input
                className="field-input"
                onChange={(event) => setSubscriberSearch(event.target.value)}
                placeholder="Search subscribers"
                value={subscriberSearch}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Status Filter</span>
              <select
                className="field-input"
                onChange={(event) =>
                  setSubscriberStatusFilter(event.target.value as SubscriberStatus | "all")
                }
                value={subscriberStatusFilter}
              >
                {subscriberStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="field-label">{subscriberDraft.id ? "Edit Subscriber" : "Add Subscriber"}</p>
                <h3 className="mt-2 text-xl font-semibold text-ink">
                  {subscriberDraft.id ? "Update subscriber details" : "Manual subscriber entry"}
                </h3>
              </div>

              {subscriberDraft.id ? (
                <button
                  className="action-button-tertiary"
                  onClick={resetSubscriberDraft}
                  type="button"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Name</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setSubscriberDraft((current) => ({...current, name: event.target.value}))
                  }
                  value={subscriberDraft.name}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Email</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setSubscriberDraft((current) => ({...current, email: event.target.value}))
                  }
                  type="email"
                  value={subscriberDraft.email}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Source</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    setSubscriberDraft((current) => ({
                      ...current,
                      source: event.target.value as SubscriberSource
                    }))
                  }
                  value={subscriberDraft.source}
                >
                  <option value="manual">Manual</option>
                  <option value="exclusive">Exclusive</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="field-label">Status</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    setSubscriberDraft((current) => ({
                      ...current,
                      status: event.target.value as SubscriberStatus
                    }))
                  }
                  value={subscriberDraft.status}
                >
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-[20px] border border-[#30343b] bg-[#15181c] px-4 py-4 text-sm text-muted">
              <input
                checked={subscriberDraft.consent_given}
                className="h-4 w-4 rounded border-white/20 bg-[#12161b] text-[#c9a347] focus:ring-[#c9a347]"
                onChange={(event) =>
                  setSubscriberDraft((current) => ({
                    ...current,
                    consent_given: event.target.checked
                  }))
                }
                type="checkbox"
              />
              Subscriber has consented to receive vvviruz campaign emails.
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                className="action-button-primary"
                onClick={() => void handleSubscriberSave()}
                type="button"
              >
                {subscriberDraft.id ? <Save size={16} /> : <UserPlus size={16} />}
                {subscriberDraft.id ? "Save Subscriber" : "Add Subscriber"}
              </button>
              <span className="pill">
                {subscriberSaveState === "saving"
                  ? "Saving..."
                  : subscriberSaveState === "error"
                    ? "Save error"
                    : subscriberSaveState === "saved"
                      ? "Saved"
                      : "Ready"}
              </span>
              {subscriberMessage ? (
                <span
                  className={`rounded-full border px-4 py-2 text-sm ${
                    subscriberSaveState === "error"
                      ? "border-[#5a312d] bg-[#1c1313] text-[#d4a7a0]"
                      : "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                  }`}
                >
                  {subscriberMessage}
                </span>
              ) : null}
            </div>
          </section>

          <div className="overflow-hidden rounded-[24px] border border-[#30343b] bg-[#121418]">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#262a30] text-sm">
                <thead className="bg-[#0f1216] text-left text-xs uppercase tracking-[0.18em] text-[#8f959d]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Consent</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262a30]">
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber.id}>
                      <td className="px-4 py-4 text-[#ece6da]">{subscriber.name || "Unknown"}</td>
                      <td className="px-4 py-4 text-[#d7dde4]">{subscriber.email}</td>
                      <td className="px-4 py-4 text-muted">
                        {formatSourceLabel(subscriber.source)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(subscriber.status)}`}>
                          {subscriber.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted">
                        {subscriber.consent_given ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-4 text-muted">
                        {formatShortDate(subscriber.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="action-button-tertiary"
                            onClick={() => beginEditSubscriber(subscriber)}
                            type="button"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          {subscriber.status !== "unsubscribed" ? (
                            <button
                              className="action-button-secondary"
                              onClick={() => void handleSubscriberUnsubscribe(subscriber)}
                              type="button"
                            >
                              <UserMinus size={14} />
                              Unsubscribe
                            </button>
                          ) : null}
                          <button
                            className="action-button-danger"
                            onClick={() => void handleSubscriberDelete(subscriber)}
                            type="button"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {subscribers.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">
                No subscribers match the current search and filter.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <Sparkles size={12} />
                Exclusive Track Offer
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Public /exclusive setup</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Configure the capture page, upload the gated track, and choose the
                artwork shown after signup.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="pill">
                {offerSaveState === "saving"
                  ? "Saving..."
                  : offerSaveState === "error"
                    ? "Save error"
                    : offerSaveState === "saved"
                      ? "Saved"
                      : "Ready"}
              </span>
              <button className="action-button-primary" onClick={() => void handleOfferSave()} type="button">
                <Save size={16} />
                Save Offer
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Badge Text</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, badge_text: event.target.value}))
                }
                value={exclusiveOffer.badge_text}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">CTA Button</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, cta_label: event.target.value}))
                }
                value={exclusiveOffer.cta_label}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Headline</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, headline: event.target.value}))
                }
                value={exclusiveOffer.headline}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Subtext</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, subtext: event.target.value}))
                }
                value={exclusiveOffer.subtext}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Brand Line</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, brand_line: event.target.value}))
                }
                value={exclusiveOffer.brand_line}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Name Field Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, name_label: event.target.value}))
                }
                value={exclusiveOffer.name_label}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Email Field Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({...current, email_label: event.target.value}))
                }
                value={exclusiveOffer.email_label}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Consent Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    consent_label: event.target.value
                  }))
                }
                value={exclusiveOffer.consent_label}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Track Title</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    exclusive_track_title: event.target.value
                  }))
                }
                value={exclusiveOffer.exclusive_track_title}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Download Label</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    download_label: event.target.value
                  }))
                }
                value={exclusiveOffer.download_label}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Track Description</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    exclusive_track_description: event.target.value
                  }))
                }
                value={exclusiveOffer.exclusive_track_description}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Success Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    success_heading: event.target.value
                  }))
                }
                value={exclusiveOffer.success_heading}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Duplicate Success Message</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    duplicate_message: event.target.value
                  }))
                }
                value={exclusiveOffer.duplicate_message}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="field-label">Success Message</span>
              <textarea
                className="field-input min-h-[110px]"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    success_message: event.target.value
                  }))
                }
                value={exclusiveOffer.success_message}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Unavailable Heading</span>
              <input
                className="field-input"
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    unavailable_heading: event.target.value
                  }))
                }
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
                  setExclusiveOffer((current) => ({
                    ...current,
                    exclusive_track_enabled: !current.exclusive_track_enabled
                  }))
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
                onChange={(event) =>
                  setExclusiveOffer((current) => ({
                    ...current,
                    unavailable_body: event.target.value
                  }))
                }
                value={exclusiveOffer.unavailable_body}
              />
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
              <p className="field-label">Track Asset</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="field-label">Select Existing Track</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setExclusiveOffer((current) => ({
                        ...current,
                        exclusive_track_file_path: event.target.value
                      }))
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
                  disabled={!trackUploadFile || isUploadingTrack}
                  onClick={() => void handleUploadAsset("track")}
                  type="button"
                >
                  <UploadCloud size={16} />
                  {isUploadingTrack ? "Uploading..." : "Upload Track"}
                </button>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
              <p className="field-label">Artwork</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="field-label">Select Existing Artwork</span>
                  <select
                    className="field-input"
                    onChange={(event) =>
                      setExclusiveOffer((current) => ({
                        ...current,
                        exclusive_track_art_path: event.target.value
                      }))
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
                  disabled={!artUploadFile || isUploadingArt}
                  onClick={() => void handleUploadAsset("art")}
                  type="button"
                >
                  <UploadCloud size={16} />
                  {isUploadingArt ? "Uploading..." : "Upload Artwork"}
                </button>

                {exclusiveOffer.exclusive_track_art_path ? (
                  <div className="rounded-[20px] border border-[#31353b] bg-[#0f1217] px-4 py-4">
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

          {offerMessage ? (
            <div
              className={`rounded-[22px] px-4 py-3 text-sm ${
                offerSaveState === "error"
                  ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                  : "border border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
              }`}
            >
              {offerMessage}
            </div>
          ) : null}
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <Mail size={12} />
                Email Campaigns
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Draft and send</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Keep campaigns simple: save drafts, send a test to the admin inbox,
                then confirm the full send.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="action-button-secondary"
                onClick={() => {
                  setCampaignDraft(createEmptyCampaignDraft());
                  setCampaignMessage(null);
                  setCampaignSaveState("idle");
                }}
                type="button"
              >
                <MailPlus size={16} />
                New Campaign
              </button>
              <button
                className="action-button-secondary"
                onClick={() => void refreshCampaigns()}
                type="button"
              >
                <RefreshCw className={isRefreshingCampaigns ? "animate-spin" : ""} size={16} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const isSelected = campaign.id === campaignDraft.id;

                return (
                  <button
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                        : "border-[#30343b] bg-[#121418] text-[#d5d9df] hover:border-[#545962] hover:bg-[#171b20]"
                    }`}
                    key={campaign.id}
                    onClick={() => {
                      setCampaignDraft(toCampaignDraft(campaign));
                      setCampaignMessage(null);
                      setCampaignSaveState("idle");
                    }}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-inherit">
                          {campaign.subject}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#9ca4ad]">
                          {formatAudienceFilter(campaign.audience_filter)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusPillClass(
                          campaign.status
                        )}`}
                      >
                        {formatCampaignStatus(campaign.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-[#98a0a8]">
                      {campaign.recipient_count} recipients • Updated{" "}
                      {formatDateTime(campaign.updated_at)}
                    </p>
                  </button>
                );
              })}

              {campaigns.length === 0 ? (
                <div className="rounded-[22px] border border-[#30343b] bg-[#121418] px-4 py-6 text-sm text-muted">
                  No campaigns yet. Save the first draft to start building history.
                </div>
              ) : null}
            </div>

            <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Subject</span>
                  <input
                    className="field-input"
                    disabled={campaignIsLocked}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({...current, subject: event.target.value}))
                    }
                    value={campaignDraft.subject}
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Preview Text</span>
                  <input
                    className="field-input"
                    disabled={campaignIsLocked}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({
                        ...current,
                        preview_text: event.target.value
                      }))
                    }
                    value={campaignDraft.preview_text}
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="field-label">Body</span>
                  <textarea
                    className="field-input min-h-[220px]"
                    disabled={campaignIsLocked}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({...current, body: event.target.value}))
                    }
                    value={campaignDraft.body}
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">CTA Label</span>
                  <input
                    className="field-input"
                    disabled={campaignIsLocked}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({
                        ...current,
                        cta_label: event.target.value
                      }))
                    }
                    value={campaignDraft.cta_label}
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">CTA URL</span>
                  <input
                    className="field-input"
                    disabled={campaignIsLocked}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({...current, cta_url: event.target.value}))
                    }
                    value={campaignDraft.cta_url}
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Audience</span>
                  <select
                    className="field-input"
                    disabled={campaignIsLocked}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({
                        ...current,
                        audience_filter: event.target.value as AudienceFilter
                      }))
                    }
                    value={campaignDraft.audience_filter}
                  >
                    {audienceFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-[20px] border border-[#30343b] bg-[#15181c] px-4 py-4 text-sm text-muted">
                  <p className="field-label">Recipient Count</p>
                  <p className="mt-3 text-2xl font-semibold text-ink">
                    {campaignDraft.recipient_count}
                  </p>
                  <p className="mt-2 leading-6">
                    Save the draft to refresh the count after audience changes.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="action-button-primary"
                  disabled={campaignIsLocked || campaignSaveState === "saving"}
                  onClick={() => void handleCampaignSave()}
                  type="button"
                >
                  <Save size={16} />
                  Save Draft
                </button>

                <button
                  className="action-button-secondary"
                  disabled={!campaignIsPersisted || campaignIsLocked || campaignSaveState === "saving"}
                  onClick={() => void handleCampaignTestSend()}
                  type="button"
                >
                  <Mail size={16} />
                  Send Test Email
                </button>

                <button
                  className="action-button-secondary"
                  disabled={
                    !campaignIsPersisted ||
                    campaignIsLocked ||
                    campaignSaveState === "saving" ||
                    campaignDraft.recipient_count === 0
                  }
                  onClick={() => void handleCampaignSend()}
                  type="button"
                >
                  <Send size={16} />
                  Send Campaign
                </button>

                <button
                  className="action-button-danger"
                  disabled={selectedCampaignRecord?.status === "sent" || campaignSaveState === "saving"}
                  onClick={() => void handleCampaignDelete()}
                  type="button"
                >
                  <Trash2 size={16} />
                  {campaignDraft.id ? "Delete Draft" : "Clear Draft"}
                </button>
              </div>

              {campaignMessage ? (
                <div
                  className={`mt-5 rounded-[22px] px-4 py-3 text-sm ${
                    campaignSaveState === "error"
                      ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                      : "border border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                  }`}
                >
                  {campaignMessage}
                </div>
              ) : null}
            </section>
          </div>
        </section>

        <section className="panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div>
            <div className="pill">
              <CheckCircle2 size={12} />
              Campaign History
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Recent sends and delivery logs</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sent campaigns lock automatically. Delivery history is stored per
              recipient so you can see failures without leaving the page.
            </p>
          </div>

          <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
            <p className="field-label">Campaigns</p>
            <div className="mt-4 space-y-3">
              {campaignHistory.map((campaign) => (
                <div
                  className="rounded-[20px] border border-[#2e3238] bg-[#0f1217] px-4 py-4"
                  key={campaign.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{campaign.subject}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                        {formatAudienceFilter(campaign.audience_filter)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusPillClass(
                        campaign.status
                      )}`}
                    >
                      {formatCampaignStatus(campaign.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {campaign.recipient_count} recipients • Sent{" "}
                    {campaign.sent_at ? formatDateTime(campaign.sent_at) : "Not yet"}
                  </p>
                </div>
              ))}

              {campaignHistory.length === 0 ? (
                <div className="rounded-[20px] border border-[#2e3238] bg-[#0f1217] px-4 py-5 text-sm text-muted">
                  Sent and failed campaigns will appear here once you start sending.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
            <p className="field-label">Delivery Logs</p>
            <div className="mt-4 space-y-3">
              {sendLogs.map((log) => {
                const campaign = campaignById.get(log.campaign_id);

                return (
                  <div
                    className="rounded-[20px] border border-[#2e3238] bg-[#0f1217] px-4 py-4"
                    key={log.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{log.email}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                          {campaign?.subject ?? "Campaign removed"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          log.status === "sent"
                            ? "border border-emerald-500/25 bg-emerald-500/12 text-emerald-200"
                            : log.status === "failed"
                              ? "border border-rose-500/25 bg-rose-500/12 text-rose-200"
                              : "border border-[#31353b] bg-[#15181c] text-[#d5d9df]"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      {log.sent_at ? formatDateTime(log.sent_at) : formatDateTime(log.created_at)}
                    </p>
                    {log.error_message ? (
                      <p className="mt-2 text-sm leading-6 text-rose-200">{log.error_message}</p>
                    ) : null}
                  </div>
                );
              })}

              {sendLogs.length === 0 ? (
                <div className="rounded-[20px] border border-[#2e3238] bg-[#0f1217] px-4 py-5 text-sm text-muted">
                  Delivery logs will appear after the first test or campaign send.
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </section>

      <section className="panel px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <p>
            Public capture lives on{" "}
            <Link className="font-semibold text-[#d7b45e] hover:text-[#edd08a]" href="/exclusive" target="_blank">
              /exclusive
            </Link>
            . Download access is token-based and the raw storage path is never exposed.
          </p>
          <p>Campaign sends exclude unsubscribed or non-consented subscribers automatically.</p>
        </div>
      </section>
    </div>
  );
}
