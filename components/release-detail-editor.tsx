"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SVGProps
} from "react";
import Image from "next/image";
import Link from "next/link";
import {useRouter} from "next/navigation";
import dynamic from "next/dynamic";

const ReleaseIntelligencePanel = dynamic(
  () => import("./release-intelligence-panel"),
  { ssr: false }
);
import {StickyActionDock} from "@/components/sticky-action-dock";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Captions,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FolderOpen,
  ImagePlus,
  Info,
  Lock,
  Link2Off,
  MousePointerClick,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Unlock
} from "lucide-react";

import {AUTOSAVE_INTERVAL_MS} from "@/lib/constants";
import {parseCollaborators, formatCollaboratorsList} from "@/lib/public-utils";
import {
  calculateReleaseProgress,
  createReleaseTask,
  getReleasePublishBlockers,
  getReleaseProgressTone,
  getSuggestedReleaseSlug,
  getDiscoveryChecklist,
  getDiscoveryReadinessLabel,
  type DiscoveryChecklistStatus,
  type DiscoveryChecklistItem
} from "@/lib/releases";
import {
  getCurrentReleasePlanningStage,
  getReleasePlanningBlockers,
  getReleasePlanningNextAction,
  hasReleaseCoverArt,
  releasePlanningStages,
  type ReleaseChecklistKey
} from "@/lib/release-planning";
import {
  formatContentType,
  formatHookType,
  formatSongSection,
  getCopyHeading
} from "@/lib/copy";
import type {
  CopySummary,
  AdCampaignLearningRecord,
  ReleaseAdMetricsOverview,
  ReleaseCoverUploadResponse,
  ReleaseRecord,
  ReleaseType,
  AdCampaignDecision,
  ReleaseCampaignHistory,
  ReleasePromoVerdict,
  ShortLinkRecord,
  CreativePerformanceMemory,
  AdPerformanceTimeline,
  CopyPerformanceMemory
} from "@/lib/types";
import { PerformanceMemorySection } from "./performance-memory";
import { getUnifiedCampaignRecommendation } from "@/lib/ads/recommendations";


const decisionOptions: Array<{value: AdCampaignDecision; label: string}> = [
  {value: "scale", label: "Scale"},
  {value: "iterate", label: "Iterate"},
  {value: "pause", label: "Pause"},
  {value: "retire", label: "Retire"},
  {value: "retest-hook", label: "Retest Hook"},
  {value: "retest-visual", label: "Retest Visual"},
  {value: "retest-audience", label: "Retest Audience"},
  {value: "needs-more-data", label: "Needs More Data"}
];

type SaveState = "idle" | "saving" | "saved" | "error";

function serializeRelease(release: ReleaseRecord) {
  return JSON.stringify(release);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function formatNullableCurrency(value: number | null) {
  return value === null ? "N/A" : formatCurrency(value);
}

function formatDecisionLabel(value: string) {
  const option = decisionOptions.find((item) => item.value === value);

  return option?.label ?? (value.trim() || "No decision");
}

function formatConfidenceSource(value: "conversion" | "ctr" | "none") {
  if (value === "conversion") {
    return "Conversion-based";
  }

  if (value === "ctr") {
    return "CTR-based";
  }

  return "Directional only";
}

function formatReleaseType(value: ReleaseType) {
  return value === "mainstream" ? "Mainstream" : "Nerdcore";
}

function getContenderLabel(
  suggestion: NonNullable<CopyPerformanceMemory["suggestions"]>[number]
) {
  return suggestion.type === "data-quality-warning" ? "Data Quality" : "Retest Candidate";
}

function getContenderBadge(
  suggestion: NonNullable<CopyPerformanceMemory["suggestions"]>[number]
) {
  if (suggestion.type === "data-quality-warning") {
    return "Setup gap";
  }

  return suggestion.reason.toLowerCase().includes("starved")
    ? "Starved signal"
    : "Low-data contender";
}

function normalizeExternalUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return new URL(trimmedValue).toString();
  } catch {
    try {
      return new URL(`https://${trimmedValue}`).toString();
    } catch {
      return null;
    }
  }
}

const orderedCheckboxStageKeys = releasePlanningStages.flatMap((stage) =>
  stage.checkboxKey ? [stage.checkboxKey] : []
);

function getStageUnlockReason(release: ReleaseRecord, key: ReleaseChecklistKey) {
  const stageIndex = releasePlanningStages.findIndex((stage) => stage.checkboxKey === key);

  if (stageIndex <= 0) {
    return null;
  }

  const blockingStage = releasePlanningStages
    .slice(0, stageIndex)
    .find((stage) => !stage.isComplete(release));

  if (!blockingStage) {
    return null;
  }

  if (blockingStage.id === "cover_art") {
    return "Upload cover art first.";
  }

  return `Mark ${blockingStage.label} complete first.`;
}

function getGeneratedCoverAltText(release: ReleaseRecord) {
  return release.title.trim()
    ? `${release.title.trim()} cover art`
    : "Release cover art";
}

function getReleaseCoverAltText(release: ReleaseRecord) {
  return release.cover_art_alt_text.trim() || getGeneratedCoverAltText(release);
}

function getFallbackMetaDescription(release: ReleaseRecord) {
  return (
    release.public_description.trim() ||
    release.public_long_description.trim() ||
    release.concept_details.trim() ||
    "No public summary written yet."
  );
}



const pageShellClass =
  "min-h-[calc(100vh-81px)] bg-[#0f1114] text-[#e7e2d8] pb-36";
const pagePanelClass =
  "rounded-[28px] border border-[#2a2d32] bg-[#17191d]";
const pageLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b8088]";
const pageInputClass =
  "w-full rounded-2xl border border-[#343840] bg-[#0f1216] px-4 py-3 text-sm text-[#ece6d8] outline-none transition placeholder:text-[#6d7279] [color-scheme:dark] focus:border-[#c9a347] focus:ring-2 focus:ring-[#c9a347]/25";
const pagePrimaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#c9a347] px-4 py-2.5 text-sm font-semibold text-[#121418] transition hover:bg-[#d5b15b]";
const pageSecondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#3a3f46] bg-[#15181c] px-4 py-2.5 text-sm font-semibold text-[#ece6d8] transition hover:border-[#50555d] hover:bg-[#1b1f24]";
const pageDangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[#7b3e3e] bg-[#341919] px-4 py-2.5 text-sm font-semibold text-[#f0d7d2] transition hover:border-[#9a5656] hover:bg-[#452020]";
const pageTertiaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-[#9ba0a8] transition hover:bg-[#181b20] hover:text-[#ede8dc]";
const pagePillClass =
  "inline-flex items-center gap-2 rounded-full border border-[#31353b] bg-[#121417] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8c9199]";
const pageAccentPillClass =
  "inline-flex items-center gap-2 rounded-full border border-[#5b4920] bg-[#1a1710] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b45d]";
const pageCheckboxClass =
  "h-4 w-4 rounded border border-[#4a4f57] bg-[#0e1115] accent-[#c9a347] focus:ring-2 focus:ring-[#c9a347]/35 focus:ring-offset-0";

function getDiscoveryStatusStyles(status: DiscoveryChecklistStatus) {
  if (status === "passed") {
    return {
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      dot: "bg-emerald-400",
      text: "text-[#e7f4e9]"
    };
  }

  if (status === "warning") {
    return {
      badge: "border-amber-500/35 bg-amber-500/10 text-amber-200",
      dot: "bg-amber-400",
      text: "text-[#f4e6c3]"
    };
  }

  return {
    badge: "border-red-500/35 bg-red-500/10 text-red-200",
    dot: "bg-red-400",
    text: "text-[#f1d2d2]"
  };
}

function getDiscoveryStatusLabel(status: DiscoveryChecklistStatus) {
  if (status === "passed") {
    return "Passed";
  }

  if (status === "warning") {
    return "Warning";
  }

  return "Missing";
}

function SpotifyLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" fill="currentColor" r="10" />
      <path
        d="M7.4 9.15c3.45-1.18 7.12-1.02 10.08.52"
        stroke="#09120b"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M8.28 12.08c2.7-.88 5.56-.72 7.83.43"
        stroke="#09120b"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path
        d="M9.15 14.88c1.95-.57 4-.42 5.6.42"
        stroke="#09120b"
        strokeLinecap="round"
        strokeWidth="1.45"
      />
    </svg>
  );
}

function YouTubeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <rect fill="currentColor" height="14" rx="4.5" width="20" x="2" y="5" />
      <path d="m10 9 5 3-5 3V9Z" fill="#fff7f5" />
    </svg>
  );
}

function AppleMusicLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path
        d="M15.6 5.2v9.7a2.8 2.8 0 1 1-1.55-2.5V8.2l-4.92 1.13v7.57a2.8 2.8 0 1 1-1.55-2.5V7.88c0-.71.49-1.33 1.18-1.48l5.55-1.28a1.43 1.43 0 0 1 1.29.29c.32.26.5.64.5 1.05Z"
        fill="currentColor"
      />
    </svg>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// V1.3 Release Intelligence Layer — pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the Release Promo Verdict from available campaign data.
 *
 * Priority rules (Level 4 rollup logic):
 *   - High-confidence signals take precedence over low-confidence ones.
 *   - A single "retire"/"pause" from a high-confidence campaign can set
 *     the verdict even if earlier campaigns were positive.
 *   - "needs-more-data" votes are treated as neutral (Testing).
 *   - Low spend with no results → Untested.
 *
 * @param adMetrics  The existing ReleaseAdMetricsOverview
 * @param latestLearning  The most recently saved AdCampaignLearning (if any)
 */

// ─────────────────────────────────────────────────────────────────────────────
// V1.3 Release Intelligence Panel component
// Rendered above the Ad Lab performance metrics block.
// All props are already available on the parent component.
// ─────────────────────────────────────────────────────────────────────────────
// Panel inlined below.

export function ReleaseDetailEditor({
  adMetrics,
  campaignHistory,
  initialLinkedCopies,
  initialShortLinks = [],
  initialRelease,
  latestAdLearning,
  creativePerformanceMemory,
  adPerformanceTimeline,
  copyPerformanceMemory,
  streamingClicksCount = 0,
  utmCoverageRate = 0,
  reports = [],
  initialPlaylists = [],
  initialPlaylistMemberships = []
}: {
  adMetrics: ReleaseAdMetricsOverview;
  campaignHistory: ReleaseCampaignHistory;
  initialLinkedCopies: CopySummary[];
  initialShortLinks?: ShortLinkRecord[];
  initialRelease: ReleaseRecord;
  latestAdLearning: AdCampaignLearningRecord | null;
  creativePerformanceMemory: CreativePerformanceMemory;
  adPerformanceTimeline: AdPerformanceTimeline;
  copyPerformanceMemory: CopyPerformanceMemory;
  streamingClicksCount?: number;
  utmCoverageRate?: number;
  reports?: any[];
  initialPlaylists?: any[];
  initialPlaylistMemberships?: any[];
}) {
  const router = useRouter();
  const [release, setRelease] = useState(initialRelease);
  const [collaborators, setCollaborators] = useState<string[]>(() =>
    parseCollaborators(initialRelease.collaborator_name)
  );
  const [linkedCopies, setLinkedCopies] = useState(initialLinkedCopies);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [taskText, setTaskText] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(
    () => initialRelease.slug.trim() === getSuggestedReleaseSlug(initialRelease.title)
  );
  const lastSavedSnapshotRef = useRef<string>(serializeRelease(initialRelease));
  const autosaveTimerRef = useRef<number | null>(null);
  const latestDraftSnapshotRef = useRef<string>(serializeRelease(initialRelease));

  // Playlist Memberships State
  const [playlistMemberships, setPlaylistMemberships] = useState(() =>
    initialPlaylistMemberships.map((m) => ({
      playlistId: m.playlistId,
      position: m.position,
      spotifyTargetUrl: m.spotifyTargetUrl,
      appleTargetUrl: m.appleTargetUrl,
      youtubeTargetUrl: m.youtubeTargetUrl,
      isActive: m.isActive
    }))
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [isSavingPlaylists, setIsSavingPlaylists] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState("");
  const [playlistError, setPlaylistError] = useState("");

  const handleAddPlaylistMembership = () => {
    setPlaylistError("");
    if (!selectedPlaylistId) return;

    if (playlistMemberships.some((m) => m.playlistId === selectedPlaylistId)) {
      setPlaylistError("This release is already a member of this playlist.");
      return;
    }

    const newMembership = {
      playlistId: selectedPlaylistId,
      position: playlistMemberships.length,
      spotifyTargetUrl: "",
      appleTargetUrl: "",
      youtubeTargetUrl: "",
      isActive: true
    };

    setPlaylistMemberships([...playlistMemberships, newMembership]);
    setSelectedPlaylistId("");
  };

  const handleRemovePlaylistMembership = (playlistId: string) => {
    setPlaylistError("");
    const filtered = playlistMemberships.filter((m) => m.playlistId !== playlistId);
    const normalized = filtered.map((m, idx) => ({...m, position: idx}));
    setPlaylistMemberships(normalized);
  };

  const handleTogglePlaylistActive = (playlistId: string) => {
    setPlaylistMemberships((current) =>
      current.map((m) => (m.playlistId === playlistId ? {...m, isActive: !m.isActive} : m))
    );
  };

  const handleUpdatePlaylistTargetUrl = (
    playlistId: string,
    field: "spotifyTargetUrl" | "appleTargetUrl" | "youtubeTargetUrl",
    value: string
  ) => {
    setPlaylistMemberships((current) =>
      current.map((m) => (m.playlistId === playlistId ? {...m, [field]: value} : m))
    );
  };

  const handleSavePlaylistMemberships = async () => {
    setPlaylistMessage("");
    setPlaylistError("");
    setIsSavingPlaylists(true);

    try {
      const response = await fetch(`/api/releases/${release.id}/playlists`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          memberships: playlistMemberships
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to save playlist memberships.");
      }

      setPlaylistMessage("Playlist memberships updated successfully!");
      router.refresh();
    } catch (err) {
      setPlaylistError(err instanceof Error ? err.message : "Failed to save playlist memberships.");
    } finally {
      setIsSavingPlaylists(false);
    }
  };

  const [learningDraft, setLearningDraft] = useState({
    summary: latestAdLearning?.summary ?? "",
    what_worked: latestAdLearning?.what_worked ?? "",
    what_failed: latestAdLearning?.what_failed ?? "",
    next_test: latestAdLearning?.next_test ?? "",
    decision: latestAdLearning?.decision ?? "iterate"
  });
  const [isSavingLearning, setIsSavingLearning] = useState(false);

  const progress = useMemo(() => calculateReleaseProgress(release), [release]);
  const recommendation = useMemo(() => {
    return getUnifiedCampaignRecommendation({
      adMetrics: {
        totalSpend: adMetrics.total_spend,
        totalResults: adMetrics.total_results,
        totalImpressions: adMetrics.total_impressions,
        totalLinkClicks: adMetrics.total_link_clicks,
        totalLandingPageViews: adMetrics.total_landing_page_views,
        clickToLandingRate: adMetrics.click_to_landing_rate,
        cpr: adMetrics.cpr,
        bestAd: adMetrics.best_ad ? {
          ad_name: adMetrics.best_ad.ad_name,
          spend: adMetrics.best_ad.spend,
          results: adMetrics.best_ad.results,
          cpr: adMetrics.best_ad.cpr,
          ctr: adMetrics.best_ad.ctr,
          signals: adMetrics.best_ad.signals
        } : null,
        bestHook: adMetrics.best_hook ? {
          label: adMetrics.best_hook.label,
          spend: adMetrics.best_hook.spend,
          results: adMetrics.best_hook.results,
          cpr: adMetrics.best_hook.cpr,
          ctr: adMetrics.best_hook.ctr
        } : null,
        worstAd: adMetrics.worst_ad ? {
          ad_name: adMetrics.worst_ad.ad_name,
          spend: adMetrics.worst_ad.spend,
          results: adMetrics.worst_ad.results,
          cpr: adMetrics.worst_ad.cpr
        } : null,
        worstHook: adMetrics.worst_hook ? {
          label: adMetrics.worst_hook.label,
          spend: adMetrics.worst_hook.spend,
          results: adMetrics.worst_hook.results,
          cpr: adMetrics.worst_hook.cpr
        } : null,
        batchCount: adMetrics.batch_count
      },
      funnel: null,
      latestLearning: latestAdLearning ? {
        decision: latestAdLearning.decision,
        next_test: latestAdLearning.next_test,
        updated_at: latestAdLearning.updated_at
      } : null,
      reports: reports ?? []
    });
  }, [adMetrics, latestAdLearning, reports]);
  const shortLinkTotalClicks = useMemo(
    () => initialShortLinks.reduce((total, link) => total + link.click_count, 0),
    [initialShortLinks]
  );
  const activeShortLinkCount = useMemo(
    () => initialShortLinks.filter((link) => link.status === "ACTIVE").length,
    [initialShortLinks]
  );
  const archivedShortLinkCount = useMemo(
    () => initialShortLinks.filter((link) => link.status === "ARCHIVED").length,
    [initialShortLinks]
  );
  const pausedShortLinkCount = useMemo(
    () => initialShortLinks.filter((link) => link.status === "PAUSED").length,
    [initialShortLinks]
  );
  const openTasks = useMemo(
    () => release.tasks.filter((task) => !task.completed),
    [release.tasks]
  );
  const completedTaskCount = release.tasks.length - openTasks.length;
  const topShortLink = useMemo(
    () =>
      [...initialShortLinks].sort(
        (left, right) => right.click_count - left.click_count
      )[0] ?? null,
    [initialShortLinks]
  );
  const snapshotStage = useMemo(
    () => getCurrentReleasePlanningStage(release).label,
    [release]
  );
  const currentStage = snapshotStage;
  const snapshotNextAction = useMemo(
    () => getReleasePlanningNextAction(release),
    [release]
  );
  const snapshotBlockers = useMemo(
    () => getReleasePlanningBlockers(release),
    [release]
  );
  const suggestedSlug = useMemo(
    () => getSuggestedReleaseSlug(release.title),
    [release.title]
  );
  const publishBlockers = useMemo(
    () => getReleasePublishBlockers(release),
    [release]
  );
  const isPublishReady = publishBlockers.length === 0;
  const coverAltTextPreview = useMemo(
    () => getReleaseCoverAltText(release),
    [release]
  );
  const discoveryChecklist = useMemo(
    () => getDiscoveryChecklist(release),
    [release]
  );
  const passedDiscoveryItems = discoveryChecklist.filter(
    (item) => item.status === "passed"
  ).length;
  const warningDiscoveryItems = discoveryChecklist.filter(
    (item) => item.status === "warning"
  ).length;
  const missingDiscoveryItems = discoveryChecklist.filter(
    (item) => item.status === "missing"
  ).length;
  const discoveryReadinessLabel = useMemo(
    () => getDiscoveryReadinessLabel(discoveryChecklist),
    [discoveryChecklist]
  );
  const seoTitlePreview =
    release.seo_title.trim() || release.title.trim() || "Untitled release";
  const metaDescriptionPreview =
    release.meta_description.trim() || getFallbackMetaDescription(release);
  const socialShareTitlePreview =
    release.social_share_title.trim() || seoTitlePreview;
  const socialShareDescriptionPreview =
    release.social_share_description.trim() || metaDescriptionPreview;
  const schemaStatusLabel = release.is_published && isPublishReady
    ? "Ready"
    : "Draft";
  const publicUrlPreview = release.slug.trim()
    ? `/music/${release.slug.trim()}`
    : "/music/untitled-release";

  const saveStatusLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save error"
        : hasPendingChanges
          ? "Unsaved changes"
          : "Saved";
  const isErrorMessage = useMemo(() => {
    if (!message) {
      return false;
    }

    const normalizedMessage = message.toLowerCase();

    return (
      saveState === "error" ||
      normalizedMessage.includes("failed") ||
      normalizedMessage.includes("error")
    );
  }, [message, saveState]);
  const streamingMetadataButtons = useMemo(
    () => [
      {
        label: "Spotify",
        href: normalizeExternalUrl(release.streaming_links.spotify),
        icon: SpotifyLogo,
        activeClassName:
          "border-[#1f8f55] bg-[#1db954] text-[#07140c] hover:bg-[#20c25a]",
        inactiveClassName:
          "border-[#31453a] bg-[#101614] text-[#72877c] hover:border-[#3a5246] hover:bg-[#141c18]"
      },
      {
        label: "Apple Music",
        href: normalizeExternalUrl(release.streaming_links.apple_music),
        icon: AppleMusicLogo,
        activeClassName:
          "border-[#b13a6c] bg-[#ff2d72] text-[#1b0710] hover:bg-[#ff4a86]",
        inactiveClassName:
          "border-[#503241] bg-[#181116] text-[#917184] hover:border-[#654253] hover:bg-[#1d141a]"
      },
      {
        label: "YouTube",
        href: normalizeExternalUrl(release.streaming_links.youtube),
        icon: YouTubeLogo,
        activeClassName:
          "border-[#a63333] bg-[#ff3b30] text-[#190606] hover:bg-[#ff544a]",
        inactiveClassName:
          "border-[#513131] bg-[#171112] text-[#95706f] hover:border-[#654040] hover:bg-[#1c1415]"
      }
    ],
    [
      release.streaming_links.apple_music,
      release.streaming_links.spotify,
      release.streaming_links.youtube
    ]
  );

  useEffect(() => {
    latestDraftSnapshotRef.current = serializeRelease(release);
  }, [release]);

  const persistRelease = useCallback(async (
    releaseToSave: ReleaseRecord,
    options?: {successMessage?: string | null}
  ) => {
    // Sanitize collaborators before saving
    const parsed = parseCollaborators(releaseToSave.collaborator_name);
    const sanitizedRelease = {
      ...releaseToSave,
      collaborator_name: parsed.join(", ")
    };
    const snapshot = serializeRelease(sanitizedRelease);
    const previousSnapshot = lastSavedSnapshotRef.current;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    lastSavedSnapshotRef.current = snapshot;
    setSaveState("saving");

    try {
      const response = await fetch(`/api/releases/${releaseToSave.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: snapshot
      });
      const payload = (await response.json()) as {
        release?: ReleaseRecord;
        message?: string;
      };

      if (!response.ok || !payload.release) {
        throw new Error(payload.message ?? "Save failed.");
      }

      lastSavedSnapshotRef.current = serializeRelease(payload.release);
      setRelease(payload.release);
      setCollaborators(parseCollaborators(payload.release.collaborator_name));
      setSaveState("saved");
      setHasPendingChanges(latestDraftSnapshotRef.current !== snapshot);

      if (options?.successMessage !== null) {
        setMessage(options?.successMessage ?? "Changes saved.");
      }
    } catch (error) {
      lastSavedSnapshotRef.current = previousSnapshot;
      setSaveState("error");
      setHasPendingChanges(true);
      setMessage(error instanceof Error ? error.message : "Save failed unexpectedly.");
    }
  }, []);

  useEffect(() => {
    const snapshot = serializeRelease(release);

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistRelease(release, {successMessage: null});
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [persistRelease, release]);

  function updateRelease(mutator: (current: ReleaseRecord) => ReleaseRecord) {
    setRelease((current) => mutator(current));
    setHasPendingChanges(true);
    setMessage(null);
  }

  function handleTitleChange(value: string) {
    updateRelease((current) => ({
      ...current,
      title: value,
      ...(isSlugLocked ? {slug: getSuggestedReleaseSlug(value)} : {})
    }));
  }

  function applySuggestedSlug() {
    updateRelease((current) => ({
      ...current,
      slug: getSuggestedReleaseSlug(current.title)
    }));
  }

  function toggleSlugLock() {
    setIsSlugLocked((current) => {
      const nextValue = !current;

      if (nextValue) {
        updateRelease((releaseDraft) => ({
          ...releaseDraft,
          slug: getSuggestedReleaseSlug(releaseDraft.title)
        }));
      }

      return nextValue;
    });
  }

  function handleStageToggle(key: ReleaseChecklistKey, checked: boolean) {
    updateRelease((current) => ({
      ...current,
      [key]: checked
    }));
  }

  async function handleManualSave() {
    if (!hasPendingChanges) {
      setMessage("No unsaved changes to save.");
      return;
    }

    await persistRelease(release, {successMessage: "Release saved."});
  }

  async function handleUnlinkCopy(copyId: string) {
    setMessage(null);

    try {
      const response = await fetch(`/api/copies/${copyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          release_id: null
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Unlink failed.");
      }

      setLinkedCopies((currentCopies) => currentCopies.filter((copy) => copy.id !== copyId));
      setMessage("Copy unlinked from this release.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unlink failed unexpectedly.");
    }
  }

  async function handleCoverUpload(file: File) {
    setIsUploadingCover(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (release.cover_art_path) {
        formData.append("previousPath", release.cover_art_path);
      }

      const response = await fetch("/api/releases/cover-upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as {
        asset?: ReleaseCoverUploadResponse["asset"];
        message?: string;
      };

      if (!response.ok || !payload.asset) {
        throw new Error(payload.message ?? "Cover art upload failed.");
      }

      const uploadedAsset = payload.asset;

      updateRelease((current) => ({
        ...current,
        cover_art: uploadedAsset,
        cover_art_path: uploadedAsset.url
      }));
      setMessage("Cover art uploaded.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cover art upload failed unexpectedly."
      );
    } finally {
      setIsUploadingCover(false);
    }
  }

  function addTask() {
    if (!taskText.trim()) {
      return;
    }

    updateRelease((current) => ({
      ...current,
      tasks: [...current.tasks, createReleaseTask(taskText.trim())]
    }));
    setTaskText("");
    setMessage(null);
  }

  function handleDeleteTask(taskId: string) {
    const shouldDelete = window.confirm("Delete this task? This cannot be undone.");

    if (!shouldDelete) {
      return;
    }

    updateRelease((current) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== taskId)
    }));
  }

  async function handleDeleteRelease() {
    const shouldDelete = window.confirm(
      "Delete this release? Linked Copy Lab entries will be unlinked, not deleted."
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/releases/${release.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Delete failed.");
      }

      router.push("/admin/releases");
      router.refresh();
    } catch (error) {
      setIsDeleting(false);
      setMessage(error instanceof Error ? error.message : "Delete failed unexpectedly.");
    }
  }

  function handleGenerateDraft() {
    if (
      learningDraft.summary ||
      learningDraft.what_worked ||
      learningDraft.what_failed ||
      learningDraft.next_test
    ) {
      if (!window.confirm("Overwrite current draft with generated learning?")) {
        return;
      }
    }

    const {
      source_label,
      source_context,
      total_spend,
      total_link_clicks,
      total_landing_page_views,
      total_results,
      cpr,
      ctr,
      cpc,
      click_to_landing_rate,
      cost_per_landing_page_view,
      best_ad,
      worst_ad,
      best_hook,
      worst_hook
    } = adMetrics;

    const summaryStr = `This report is based on ${source_label} for ${source_context?.reporting_start ? formatTimestamp(source_context.reporting_start) : "unknown date"} to ${source_context?.reporting_end ? formatTimestamp(source_context.reporting_end) : "unknown date"} using ${source_context?.attribution_setting || "default attribution"}. The campaign spent ${formatCurrency(total_spend)}, generated ${formatNumber(total_link_clicks)} clicks, ${formatNumber(total_landing_page_views)} landing views, ${formatNumber(total_results)} results, ${cpr !== null ? formatCurrency(cpr) : "N/A"} CPR, ${ctr !== null ? formatPercentage(ctr) : "N/A"} CTR, ${cpc !== null ? formatCurrency(cpc) : "N/A"} CPC, ${click_to_landing_rate !== null ? formatPercentage(click_to_landing_rate) : "N/A"} click-to-landing rate, and ${cost_per_landing_page_view !== null ? formatCurrency(cost_per_landing_page_view) : "N/A"} cost per landing view.`;

    let workedStr = "";
    if (best_ad || best_hook) {
      if (best_ad) {
        workedStr += `The strongest creative was "${best_ad.ad_name}" at ${best_ad.cpr !== null ? formatCurrency(best_ad.cpr) : "N/A"} CPR. `;
      }
      if (best_hook) {
        workedStr += `The top performing hook angle was ${formatHookType(best_hook.label as any)} at ${best_hook.cpr !== null ? formatCurrency(best_hook.cpr) : "N/A"} CPR. `;
      }
      if (best_ad?.signals && best_ad.signals.length > 0) {
        workedStr += `High-level signal: ${best_ad.signals[0]}.`;
      }
    } else {
      workedStr = "No clear winners identified yet.";
    }

    let failedStr = "";
    if (worst_ad || worst_hook) {
      if (worst_ad) {
        failedStr += `The weakest creative crossing the minimum spend threshold was "${worst_ad.ad_name}" at ${worst_ad.cpr !== null ? formatCurrency(worst_ad.cpr) : "N/A"} CPR. `;
      }
      if (worst_hook) {
        failedStr += `The weakest hook signal was ${formatHookType(worst_hook.label as any)}. `;
      }
    } else {
      failedStr = "No significant failures identified or spend is too low to determine.";
    }

    let nextTestStr = "";
    if (best_hook) {
      nextTestStr += `Test another creative using the ${formatHookType(best_hook.label as any)} hook type. `;
    }
    if (best_ad) {
      nextTestStr += `Use "${best_ad.ad_name}" as the reference creative for the next iteration. `;
    }
    if (worst_hook) {
      nextTestStr += `Retest ${formatHookType(worst_hook.label as any)} only with stronger creative or keep it secondary.`;
    }
    if (!nextTestStr) {
      nextTestStr = "Continue testing new hooks and creatives to find a baseline.";
    }

    // V1.2: Use controlled decision labels
    let decision: AdCampaignDecision = "iterate";
    if (total_spend > 50 && cpr !== null && cpr < 0.5) {
      decision = "scale";
    } else if (best_ad && worst_ad) {
      decision = "iterate";
    } else if (total_results > 0 && total_spend < 50) {
      decision = "needs-more-data";
    } else if (total_spend > 50 && (cpr === null || cpr > 2)) {
      decision = "pause";
    }

    setLearningDraft({
      summary: summaryStr.trim(),
      what_worked: workedStr.trim(),
      what_failed: failedStr.trim(),
      next_test: nextTestStr.trim(),
      decision
    });
  }

  async function handleLearningSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adMetrics.batches.length) return;
    
    setIsSavingLearning(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/ads/batches/${adMetrics.batches[0].id}/learnings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...learningDraft,
          release_id: release.id
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Learning save failed.");
      }

      setMessage("Campaign learning saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning save failed.");
    } finally {
      setIsSavingLearning(false);
    }
  }

  return (
    <main className={`${pageShellClass} px-4 py-5 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-[1450px] space-y-6">
        <section className={`${pagePanelClass} overflow-hidden px-6 py-7`}>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className={pagePillClass}>Release Detail</div>
                <div className={pagePillClass}>#{release.id.slice(0, 8)}</div>
                <div className={pagePillClass}>{formatReleaseType(release.type)}</div>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#f1ebdf] sm:text-4xl">
                {release.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8e939b]">
                Source-of-truth workspace for release identity, media, discovery
                packaging, planning, and lightweight promo readouts.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#31353b] bg-[#111317] p-4 sm:p-5">
              <div className="rounded-[22px] border border-[#3a3f46] bg-[#16191d] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={pageLabelClass}>Internal Progress</p>
                  <span className={pageAccentPillClass}>{progress}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#23262c]">
                  <div
                    className={`h-full rounded-full ${getReleaseProgressTone(progress)}`}
                    style={{width: `${progress}%`}}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm text-[#8d9299]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Stage</span>
                    <span className="font-semibold text-[#efe8db]">{currentStage}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Collaborators</span>
                    <span className="font-semibold text-[#efe8db]">
                      {release.collaborator
                        ? formatCollaboratorsList(release.collaborator_name) || "Yes"
                        : "No"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Autosave</span>
                    <span className="font-semibold text-[#efe8db]">Every minute</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Save status</span>
                    <span className="font-semibold text-[#efe8db]">
                      {saveStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className={`${pagePanelClass} scroll-mt-36 space-y-5 px-4 py-5 sm:px-6 sm:py-6`} id="overview">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={pageLabelClass}>Overview</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                    Basic Info
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#8a9098]">
                    Core identity, collaborator credits, dates, and distributor
                    identifiers stay here.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Title</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    value={release.title}
                  />
                </label>

                <label className="space-y-2">
                  <span className={pageLabelClass}>Release Type</span>
                  <select
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        type: event.target.value as ReleaseType
                      }))
                    }
                    value={release.type}
                  >
                    <option value="nerdcore">Nerdcore</option>
                    <option value="mainstream">Mainstream</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className={pageLabelClass}>Release Date</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        release_date: event.target.value
                      }))
                    }
                    type="date"
                    value={release.release_date}
                  />
                </label>

                <label className="space-y-2">
                  <span className={pageLabelClass}>Collaborators</span>
                  <select
                    className={pageInputClass}
                    onChange={(event) => {
                      const isYes = event.target.value === "yes";
                      if (!isYes) {
                        setCollaborators([]);
                      } else {
                        setCollaborators([""]);
                      }
                      updateRelease((current) => ({
                        ...current,
                        collaborator: isYes,
                        collaborator_name: ""
                      }));
                    }}
                    value={release.collaborator ? "yes" : "no"}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>

                {release.collaborator ? (
                  <div className="space-y-3 pb-2">
                    <span className={`${pageLabelClass} block`}>Collaborators List</span>
                    <div className="space-y-2">
                      {collaborators.map((name, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            className={`${pageInputClass} flex-1`}
                            onChange={(event) => {
                              const updated = [...collaborators];
                              updated[index] = event.target.value;
                              setCollaborators(updated);
                              updateRelease((current) => ({
                                ...current,
                                collaborator_name: updated.join(",")
                              }));
                            }}
                            placeholder={`Collaborator #${index + 1}`}
                            value={name}
                          />
                          {collaborators.length > 1 && (
                            <button
                              type="button"
                              className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/30 transition"
                              onClick={() => {
                                const updated = collaborators.filter((_, i) => i !== index);
                                setCollaborators(updated);
                                updateRelease((current) => ({
                                  ...current,
                                  collaborator_name: updated.join(",")
                                }));
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      {collaborators.length < 10 && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9a347]/30 bg-[#c9a347]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#d7b45e] hover:bg-[#c9a347]/20 transition"
                          onClick={() => {
                            const updated = [...collaborators, ""];
                            setCollaborators(updated);
                            updateRelease((current) => ({
                              ...current,
                              collaborator_name: updated.join(",")
                            }));
                          }}
                        >
                          + Add Collaborator
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                <label className="space-y-2">
                  <span className={pageLabelClass}>UPC</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        upc: event.target.value
                      }))
                    }
                    placeholder="Optional UPC"
                    value={release.upc}
                  />
                </label>

                <label className="space-y-2">
                  <span className={pageLabelClass}>ISRC</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        isrc: event.target.value
                      }))
                    }
                    placeholder="Optional ISRC"
                    value={release.isrc}
                  />
                </label>
              </div>
            </section>

            <section className={`${pagePanelClass} scroll-mt-36 space-y-4 px-4 py-5 sm:px-6 sm:py-6`} id="discovery">
              <div>
                <p className={pageLabelClass}>Discovery</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Internet Packaging
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  How this release appears to Google, AI search, social previews,
                  and public discovery surfaces.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={pageLabelClass}>Public URL</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={pageSecondaryButtonClass}
                        onClick={toggleSlugLock}
                        type="button"
                      >
                        {isSlugLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        {isSlugLocked ? "Locked to Title" : "Custom Slug"}
                      </button>
                      <button
                        className={pageSecondaryButtonClass}
                        onClick={applySuggestedSlug}
                        type="button"
                      >
                        <RefreshCw size={16} />
                        Use Suggested
                      </button>
                    </div>
                  </div>

                  <input
                    className={`${pageInputClass} ${
                      isSlugLocked ? "cursor-not-allowed opacity-80" : ""
                    }`}
                    disabled={isSlugLocked}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        slug: event.target.value
                      }))
                    }
                    placeholder="url-safe-release-slug"
                    value={release.slug}
                  />

                  <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-3 text-sm text-[#9aa0a8]">
                    <p>
                      Suggested slug:{" "}
                      <span className="font-mono text-[#efe7d7]">{suggestedSlug}</span>
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#7f858d]">
                      {isSlugLocked
                        ? "Slug updates automatically when the title changes."
                        : "Unlock the slug when you need a custom URL, then use Suggested to snap it back."}
                    </p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-3 text-sm">
                      <p className={pageLabelClass}>Live path preview</p>
                      <p className="mt-2 break-all font-mono text-[#efe7d7]">
                        {publicUrlPreview}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-3 text-sm">
                      <p className={pageLabelClass}>Cover alt preview</p>
                      <p className="mt-2 text-[#efe7d7]">{coverAltTextPreview}</p>
                    </div>
                  </div>
                </div>

                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Public Summary</span>
                  <textarea
                    className={`${pageInputClass} min-h-[120px]`}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        public_description: event.target.value
                      }))
                    }
                    placeholder="Short public-facing summary for music cards, previews, and search snippets."
                    value={release.public_description}
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Release Story / Extended Description</span>
                  <textarea
                    className={`${pageInputClass} min-h-[160px]`}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        public_long_description: event.target.value
                      }))
                    }
                    placeholder="Longer public context for the release page and AI-search style answers."
                    value={release.public_long_description}
                  />
                </label>

                <div className="grid gap-4 md:col-span-2 xl:grid-cols-2">
                  <label className="space-y-2">
                    <span className={pageLabelClass}>SEO Title</span>
                    <input
                      className={pageInputClass}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          seo_title: event.target.value
                        }))
                      }
                      placeholder={`Fallback: ${seoTitlePreview}`}
                      value={release.seo_title}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={pageLabelClass}>Social Share Title</span>
                    <input
                      className={pageInputClass}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          social_share_title: event.target.value
                        }))
                      }
                      placeholder={`Fallback: ${socialShareTitlePreview}`}
                      value={release.social_share_title}
                    />
                  </label>

                  <label className="space-y-2 xl:col-span-2">
                    <span className={pageLabelClass}>Meta Description</span>
                    <textarea
                      className={`${pageInputClass} min-h-[105px]`}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          meta_description: event.target.value
                        }))
                      }
                      placeholder={`Fallback: ${metaDescriptionPreview}`}
                      value={release.meta_description}
                    />
                  </label>

                  <label className="space-y-2 xl:col-span-2">
                    <span className={pageLabelClass}>Social Share Description</span>
                    <textarea
                      className={`${pageInputClass} min-h-[105px]`}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          social_share_description: event.target.value
                        }))
                      }
                      placeholder={`Fallback: ${socialShareDescriptionPreview}`}
                      value={release.social_share_description}
                    />
                  </label>

                  <label className="space-y-2 xl:col-span-2">
                    <span className={pageLabelClass}>Cover Art Alt Text</span>
                    <input
                      className={pageInputClass}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          cover_art_alt_text: event.target.value
                        }))
                      }
                      placeholder={`Fallback: ${getGeneratedCoverAltText(release)}`}
                      value={release.cover_art_alt_text}
                    />
                  </label>

                  <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4 xl:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className={pageLabelClass}>Public metadata preview</p>
                      <span className={pageAccentPillClass}>Live fallback</span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7f858d]">
                          Search
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#efe7d7]">
                          {seoTitlePreview}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#c8ced6]">
                          {metaDescriptionPreview}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7f858d]">
                          Social
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#efe7d7]">
                          {socialShareTitlePreview}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#c8ced6]">
                          {socialShareDescriptionPreview}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <details className="group md:col-span-2 rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#ede7dc]">
                    <span>Future discovery fields</span>
                    <ChevronDown className="transition group-open:rotate-180" size={17} />
                  </summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      "FAQ / AI answer blocks",
                      "Indexing toggle",
                      "Hide unreleased from search"
                    ].map((field) => (
                      <div
                        className="rounded-[18px] border border-dashed border-[#3a3f46] bg-[#0f1216] px-4 py-3 text-sm text-[#8a9098]"
                        key={field}
                      >
                        <span className={pageLabelClass}>{field}</span>
                        <p className="mt-2">Planned field. Current release behavior is unchanged.</p>
                      </div>
                    ))}
                  </div>
                </details>

                <label className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
                  <span className="flex items-center gap-3 text-sm font-semibold text-[#ede7dc]">
                    <input
                      checked={release.public_lyrics_enabled}
                      className={pageCheckboxClass}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          public_lyrics_enabled: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    Include Lyrics Publicly
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#8a9098]">
                    Controls whether lyrics are included on the public release page.
                  </span>
                </label>

                <label className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
                  <span className="flex items-center gap-3 text-sm font-semibold text-[#ede7dc]">
                    <input
                      checked={release.is_featured}
                      className={pageCheckboxClass}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          is_featured: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    Feature this release
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#8a9098]">
                    Featured releases get priority placement on the public site.
                  </span>
                </label>

                <div className="space-y-3 md:col-span-2">
                  <button
                    aria-pressed={release.is_published}
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                      release.is_published
                        ? "border-[#7a6130] bg-[#1a1710]"
                        : isPublishReady
                          ? "border-[#5f4b1f] bg-[#1a1710]"
                          : "border-[#4e3a1c] bg-[#17130d] opacity-95"
                    }`}
                    disabled={!release.is_published && !isPublishReady}
                    onClick={() =>
                      updateRelease((current) => ({
                        ...current,
                        is_published: !current.is_published
                      }))
                    }
                    type="button"
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          release.is_published
                            ? "border-[#d6b45d] bg-[#c9a347] text-[#121418]"
                            : isPublishReady
                              ? "border-[#8a6d34] bg-transparent text-[#d6b45d]"
                              : "border-[#6f5328] bg-transparent text-[#8a6d34]"
                        }`}
                      >
                        {release.is_published ? (
                          <Check size={13} />
                        ) : !isPublishReady ? (
                          <Lock size={11} />
                        ) : null}
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#efe7d7]">
                          Publicly Visible
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-[#bda980]">
                          Controls public visibility under `/`, `/music`, `/about`,
                          and `/links`. Internal stage completion remains separate.
                        </span>
                      </span>
                    </span>
                  </button>

                  <div
                    className={`rounded-[20px] border px-4 py-4 text-sm ${
                      isPublishReady
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                        : "border-amber-500/30 bg-amber-500/10 text-[#f2dfb5]"
                    }`}
                  >
                    <p className="font-semibold">
                      {isPublishReady
                        ? "Public Publish Ready"
                        : "Public Publish Ready Blockers"}
                    </p>
                    {isPublishReady ? (
                      <p className="mt-2 leading-6 text-emerald-100/85">
                        Core public-site fields are in place. You can safely mark this
                        release visible on the public site.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 leading-6 text-[#efdfba]">
                          Resolve these before turning on public visibility:
                        </p>
                        <ul className="mt-3 space-y-2 text-xs uppercase tracking-[0.16em] text-[#f3e1b7]">
                          {publishBlockers.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:col-span-2 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
                    <p className={pageLabelClass}>Schema status</p>
                    <div className="mt-3">
                      <span
                        className={
                          schemaStatusLabel === "Ready"
                            ? pageAccentPillClass
                            : pagePillClass
                        }
                      >
                        {schemaStatusLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#8a9098]">
                      Preview only. Structured data can use existing release fields
                      when the public page is visible.
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={pageLabelClass}>Discovery Quality Checklist</p>
                        <h3 className="mt-2 text-xl font-semibold text-[#f0eadf]">
                          {discoveryReadinessLabel}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                          {passedDiscoveryItems} passed
                        </span>
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                          {warningDiscoveryItems} warning
                        </span>
                        <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-200">
                          {missingDiscoveryItems} missing
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#8a9098]">
                      Computed from the release record only. This is search, social,
                      and AI-readable guidance, not a save or public-publishing blocker.
                    </p>
                    <div className="mt-4 grid gap-3">
                      {discoveryChecklist.map((item) => {
                        const statusStyles = getDiscoveryStatusStyles(item.status);

                        return (
                        <div
                          className="rounded-[18px] border border-[#2f343b] bg-[#0f1216] px-4 py-3"
                          key={item.label}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${statusStyles.dot}`}
                                />
                                <p className={`text-sm font-semibold ${statusStyles.text}`}>
                                  {item.label}
                                </p>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-[#8a9098]">
                                {item.detail}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusStyles.badge}`}
                            >
                              {getDiscoveryStatusLabel(item.status)}
                            </span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Overview</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Release Concept
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Internal creative direction, rollout angle, and notes for the
                  release itself.
                </p>
              </div>

              <textarea
                className={`${pageInputClass} min-h-[180px]`}
                onChange={(event) =>
                  updateRelease((current) => ({
                    ...current,
                    concept_details: event.target.value
                  }))
                }
                placeholder="Write the concept, rollout angle, and any important notes here..."
                value={release.concept_details}
              />
            </section>

            <section className={`${pagePanelClass} scroll-mt-36 space-y-4 px-4 py-5 sm:px-6 sm:py-6`} id="media">
              <div>
                <p className={pageLabelClass}>Media</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Cover Art</h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Primary public artwork and visual source for cards, previews,
                  and share images.
                </p>
              </div>

              {release.cover_art ? (
                <div className="overflow-hidden rounded-[24px] border border-[#30343b] bg-[#111318]">
                  <div className="relative aspect-square w-full max-w-md">
                    <Image
                      alt={coverAltTextPreview}
                      className="object-cover"
                      fill
                      sizes="(max-width: 768px) 100vw, 420px"
                      src={release.cover_art.url}
                      unoptimized
                    />
                  </div>
                  <div className="border-t border-[#30343b] px-4 py-3">
                    <p className="text-sm font-semibold text-[#ede7db]">
                      {release.cover_art.fileName}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#373b42] bg-[#111317] px-5 py-6 text-sm text-[#7f858d]">
                  No cover art uploaded yet.
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Link
                  className={pageSecondaryButtonClass}
                  href={`/admin/photo-lab?releaseId=${release.id}`}
                >
                  <Sparkles size={16} />
                  Photo Lab (Preview)
                </Link>

                <label className={`${pagePrimaryButtonClass} cursor-pointer`}>
                  <ImagePlus size={16} />
                  {isUploadingCover ? "Uploading cover..." : "Choose Cover Art"}
                  <input
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingCover}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        void handleCoverUpload(file);
                      }

                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>

                {release.cover_art ? (
                  <button
                    className={pageSecondaryButtonClass}
                    onClick={() =>
                      updateRelease((current) => ({
                        ...current,
                        cover_art: null,
                        cover_art_path: ""
                      }))
                    }
                    type="button"
                  >
                    <Trash2 size={16} />
                    Remove Cover
                  </button>
                ) : null}
              </div>
            </section>

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Media</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Lyrics</h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Source lyrics stay here. Discovery controls whether they are
                  included publicly.
                </p>
              </div>

              <textarea
                className={`${pageInputClass} min-h-[220px]`}
                onChange={(event) =>
                  updateRelease((current) => ({
                    ...current,
                    lyrics: event.target.value
                  }))
                }
                placeholder="Paste or write the full lyrics here..."
                value={release.lyrics}
              />
            </section>

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Overview</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Stage Completion
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Move through the release in order: concept, cover art, beat made,
                  lyrics, recorded, mix/mastered, then published. Each checkbox
                  unlocks only after every earlier stage is complete.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {releasePlanningStages.map((stage) => {
                  if (!stage.checkboxKey) {
                    const coverArtComplete = stage.isComplete(release);

                    return (
                      <div
                        className={`rounded-[20px] border px-4 py-3 text-sm ${
                          coverArtComplete
                            ? "border-[#5f4b1f] bg-[#1a1710] text-[#efe7d7]"
                            : "border-[#31353b] bg-[#14171b] text-[#d1d5db]"
                        }`}
                        key={stage.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-semibold">{stage.label}</span>
                          <span
                            className={
                              coverArtComplete ? pageAccentPillClass : pagePillClass
                            }
                          >
                            {coverArtComplete ? "Complete" : "Missing"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#8a9098]">
                          {coverArtComplete
                            ? "Cover art is in place and the next stage is unlocked."
                            : "Upload cover art in the section above to unlock Beat Made."}
                        </p>
                      </div>
                    );
                  }

                  const unlockReason = getStageUnlockReason(release, stage.checkboxKey);
                  const isDisabled = false;
                  const stageRequirements = stage.getRequirements(release);
                  const helperText = unlockReason
                    ? unlockReason
                    : stageRequirements.length > 0
                      ? stageRequirements[0].nextAction
                      : release[stage.checkboxKey]
                        ? "Stage complete."
                        : "Ready to check when this stage is approved.";

                  return (
                    <label
                      className={`rounded-[20px] border px-4 py-3 text-sm transition ${
                        release[stage.checkboxKey]
                          ? "border-[#5f4b1f] bg-[#1a1710] text-[#efe7d7]"
                          : isDisabled
                            ? "border-[#2b2f35] bg-[#111419] text-[#70757d]"
                            : "border-[#31353b] bg-[#14171b] text-[#d1d5db]"
                      }`}
                      key={stage.id}
                    >
                      <span className="flex flex-wrap items-center gap-3 font-semibold">
                        <input
                          checked={release[stage.checkboxKey]}
                          className={pageCheckboxClass}
                          disabled={isDisabled}
                          onChange={(event) =>
                            handleStageToggle(stage.checkboxKey!, event.target.checked)
                          }
                          type="checkbox"
                        />
                        {stage.label}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-[#8a9098]">
                        {helperText}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Media</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Streaming Links & Video
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Public playback destinations and optional video embed source.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Featured Video URL</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        featured_video_url: event.target.value
                      }))
                    }
                    placeholder="Optional YouTube or video URL"
                    type="url"
                    value={release.featured_video_url}
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Spotify</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        streaming_links: {
                          ...current.streaming_links,
                          spotify: event.target.value
                        }
                      }))
                    }
                    placeholder="Spotify release link"
                    type="url"
                    value={release.streaming_links.spotify}
                  />
                </label>

                <label className="space-y-2">
                  <span className={pageLabelClass}>Apple Music</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        streaming_links: {
                          ...current.streaming_links,
                          apple_music: event.target.value
                        }
                      }))
                    }
                    placeholder="Apple Music release link"
                    type="url"
                    value={release.streaming_links.apple_music}
                  />
                </label>

                <label className="space-y-2">
                  <span className={pageLabelClass}>YouTube</span>
                  <input
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        streaming_links: {
                          ...current.streaming_links,
                          youtube: event.target.value
                        }
                      }))
                    }
                    placeholder="YouTube release link"
                    type="url"
                    value={release.streaming_links.youtube}
                  />
                </label>
              </div>
            </section>

            <section className={`${pagePanelClass} scroll-mt-36 space-y-4 px-4 py-5 sm:px-6 sm:py-6`} id="promo-summary">
              <div>
                <p className={pageLabelClass}>Promo Summary</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Copy Snapshot
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Linked Copy Lab entries appear here for context. Creation and
                  editing still live in Promo.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className={pagePrimaryButtonClass}
                  href={`/admin/copy-lab/new?releaseId=${release.id}`}
                >
                  <Captions size={16} />
                  Create Copy
                </Link>
              </div>

              <div className="space-y-3">
                {linkedCopies.map((linkedCopy) => (
                  <article
                    className="rounded-[22px] border border-[#31353b] bg-[#14171b] p-4"
                    key={linkedCopy.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[#ede7dc]">
                          {getCopyHeading(linkedCopy)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#8a9098]">
                          {linkedCopy.caption.trim() || "No caption written yet."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={pagePillClass}>
                            {formatHookType(linkedCopy.hook_type)}
                          </span>
                          <span className={pagePillClass}>
                            {formatContentType(linkedCopy.content_type)} (Legacy)
                          </span>
                          <span className={pagePillClass}>
                            {formatSongSection(linkedCopy.song_section)} (Legacy)
                          </span>
                          <span className={pagePillClass}>
                            Created {formatTimestamp(linkedCopy.created_on)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          className={pageSecondaryButtonClass}
                          href={`/admin/copy-lab/${linkedCopy.id}`}
                        >
                          <FolderOpen size={16} />
                          Open
                        </Link>
                        <button
                          className={pageTertiaryButtonClass}
                          onClick={() => void handleUnlinkCopy(linkedCopy.id)}
                          type="button"
                        >
                          <Link2Off size={16} />
                          Unlink
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {linkedCopies.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#383c43] bg-[#121418] px-4 py-5 text-sm text-[#7f858d]">
                    No Copy Lab entries are linked to this release yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section className={`${pagePanelClass} space-y-6 px-4 py-5 sm:px-6 sm:py-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={pageLabelClass}>Promo Summary</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                    Campaign Readout
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9098]">
                    Lightweight performance context. Deeper campaign execution
                    stays inside Ad Lab and Attribution.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className={pageSecondaryButtonClass} href={`/admin/attribution?releaseId=${release.id}`}>
                    Open Attribution
                  </Link>
                  <Link className={pageSecondaryButtonClass} href={`/admin/ad-lab?releaseId=${release.id}`}>
                    Open Ad Lab
                  </Link>
                </div>
              </div>

              <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={pageLabelClass}>Short Links</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#efe7db]">
                      Campaign Handoff
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#8a9098]">
                      Quick readout only. Full short-link management stays in Short Links.
                    </p>
                  </div>
                  <Link className={pageSecondaryButtonClass} href="/admin/short-links">
                    Create Short Link
                    <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border border-[#2d3138] bg-[#0f1216] px-4 py-3">
                    <p className={pageLabelClass}>Active Links</p>
                    <p className="mt-2 text-2xl font-semibold text-[#efe7db]">
                      {formatNumber(activeShortLinkCount)}
                    </p>
                    <p className="mt-1 text-xs text-[#8a9098]">
                      {formatNumber(archivedShortLinkCount)} archived / {formatNumber(pausedShortLinkCount)} paused
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#2d3138] bg-[#0f1216] px-4 py-3">
                    <p className={pageLabelClass}>Total Clicks</p>
                    <p className="mt-2 text-2xl font-semibold text-[#efe7db]">
                      {formatNumber(shortLinkTotalClicks)}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#2d3138] bg-[#0f1216] px-4 py-3">
                    <p className={pageLabelClass}>Top Link</p>
                    <p className="mt-2 break-all text-sm font-semibold text-[#efe7db]">
                      {topShortLink ? `/p/${topShortLink.slug}` : "No linked short links yet"}
                    </p>
                    <p className="mt-1 text-xs text-[#8a9098]">
                      {topShortLink
                        ? `${formatNumber(topShortLink.click_count)} clicks`
                        : "Attach one from Short Links when ready."}
                    </p>
                  </div>
                </div>
              </div>

                <>
                <ReleaseIntelligencePanel
                  adMetrics={adMetrics}
                  latestAdLearning={latestAdLearning}
                  releaseTitle={initialRelease.title}
                  streamingClicksCount={streamingClicksCount}
                  utmCoverageRate={utmCoverageRate}
                  releaseId={release.id}
                  reports={reports}
                />

                <details
                  className="rounded-[22px] border border-[#31353b] bg-[#121418] scroll-mt-28"
                  id="campaign-history"
                >
                  <summary className="cursor-pointer list-none px-4 py-5 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className={pageLabelClass}>Campaign History</p>
                      <h3 className="mt-2 text-xl font-semibold text-[#efe7db]">
                        Campaign memory details
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9098]">
                        Open the archived test-cycle timeline when you need previous
                        decisions, winner comparisons, and immutable campaign context.
                      </p>
                    </div>
                    <span className={pagePillClass}>
                      {formatNumber(campaignHistory.archived_cycles.length)} archived
                    </span>
                  </div>
                  </summary>

                  <div className="border-t border-[#31353b] px-4 py-5 sm:px-5">

                  {campaignHistory.comparison ? (
                    <div className="mt-5 rounded-[20px] border border-[#3a3324] bg-[#191713] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className={pageLabelClass}>Previous Winner vs Current Winner</p>
                          <h4 className="mt-2 text-base font-semibold text-[#efe7db]">
                            {campaignHistory.comparison.mode}
                          </h4>
                        </div>
                        {campaignHistory.comparison.ranges_overlap ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
                            Overlapping snapshot
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-[18px] border border-[#30343b] bg-[#101318] px-4 py-3">
                          <p className={pageLabelClass}>Archived decision</p>
                          <p className="mt-2 text-sm font-semibold text-[#efe7db]">
                            {campaignHistory.comparison.archived_winner?.ad_name ?? "No archived winner isolated"}
                          </p>
                          {campaignHistory.comparison.archived_winner ? (
                            <p className="mt-2 text-xs leading-5 text-[#8a9098]">
                              {campaignHistory.comparison.archived_winner.visual} / {campaignHistory.comparison.archived_winner.songSection}
                              {campaignHistory.comparison.archived_winner.revision && campaignHistory.comparison.archived_winner.revision !== "Unparsed" ? ` / ${campaignHistory.comparison.archived_winner.revision}` : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-[18px] border border-[#30343b] bg-[#101318] px-4 py-3">
                          <p className={pageLabelClass}>Current snapshot</p>
                          <p className="mt-2 text-sm font-semibold text-[#efe7db]">
                            {campaignHistory.comparison.current_winner?.ad_name ?? "No current winner isolated"}
                          </p>
                          {campaignHistory.comparison.current_winner ? (
                            <p className="mt-2 text-xs leading-5 text-[#8a9098]">
                              {campaignHistory.comparison.current_winner.visual} / {campaignHistory.comparison.current_winner.songSection}
                              {campaignHistory.comparison.current_winner.revision && campaignHistory.comparison.current_winner.revision !== "Unparsed" ? ` / ${campaignHistory.comparison.current_winner.revision}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    {campaignHistory.archived_cycles.map((cycle) => (
                      <article
                        className="rounded-[20px] border border-[#30343b] bg-[#101318] px-4 py-4"
                        key={cycle.learning_id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">
                                Archived decision
                              </span>
                              <span className={pagePillClass}>{formatDecisionLabel(cycle.final_decision)}</span>
                              <span className={pagePillClass}>{cycle.batch_type}</span>
                            </div>
                            <h4 className="mt-3 text-base font-semibold text-[#efe7db]">
                              {cycle.batch_name || "Imported Meta report"}
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-[#8a9098]">
                              Reviewed {formatTimestamp(cycle.reviewed_at)} by {cycle.reviewed_by || "admin"}
                            </p>
                            {cycle.reporting_start && cycle.reporting_end ? (
                              <p className="mt-1 text-xs leading-5 text-[#8a9098]">
                                Reporting window: {formatTimestamp(cycle.reporting_start)} to {formatTimestamp(cycle.reporting_end)}
                              </p>
                            ) : null}
                          </div>
                          <Link className={pageSecondaryButtonClass} href={`/admin/ad-lab/${cycle.batch_id}`}>
                            Open Batch
                            <ArrowRight size={16} />
                          </Link>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          <div className="rounded-[16px] border border-[#282d34] bg-[#0c0f13] px-3 py-3">
                            <p className={pageLabelClass}>Spend</p>
                            <p className="mt-2 text-sm font-semibold text-[#efe7db]">{formatCurrency(cycle.spend)}</p>
                          </div>
                          <div className="rounded-[16px] border border-[#282d34] bg-[#0c0f13] px-3 py-3">
                            <p className={pageLabelClass}>Results</p>
                            <p className="mt-2 text-sm font-semibold text-[#efe7db]">{formatNumber(cycle.results)}</p>
                          </div>
                          <div className="rounded-[16px] border border-[#282d34] bg-[#0c0f13] px-3 py-3">
                            <p className={pageLabelClass}>Cost / Result</p>
                            <p className="mt-2 text-sm font-semibold text-[#efe7db]">{formatNullableCurrency(cycle.cost_per_result)}</p>
                          </div>
                          <div className="rounded-[16px] border border-[#282d34] bg-[#0c0f13] px-3 py-3 lg:col-span-2">
                            <p className={pageLabelClass}>Confidence Signal</p>
                            <p className="mt-2 text-sm font-semibold text-[#efe7db]">{cycle.confidence_score}</p>
                            <p className="mt-1 text-xs text-[#8a9098]">{formatConfidenceSource(cycle.confidence_source)}</p>
                          </div>
                        </div>

                        {cycle.top_creative ? (
                          <div className="mt-4 rounded-[16px] border border-[#282d34] bg-[#0c0f13] px-3 py-3">
                            <p className={pageLabelClass}>Top Creative / Winner</p>
                            <p className="mt-2 text-sm font-semibold text-[#efe7db]">{cycle.top_creative.ad_name}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={pagePillClass}>Visual: {cycle.top_creative.visual}</span>
                              <span className={pagePillClass}>Song Section: {cycle.top_creative.songSection}</span>
                              {cycle.top_creative.revision && cycle.top_creative.revision !== "Unparsed" && (
                                <span className={pagePillClass}>Revision: {cycle.top_creative.revision}</span>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {cycle.human_override_notes ? (
                          <p className="mt-4 rounded-[16px] border border-[#282d34] bg-[#0c0f13] px-3 py-3 text-sm leading-6 text-[#b8bec6]">
                            {cycle.human_override_notes}
                          </p>
                        ) : null}
                      </article>
                    ))}

                    {campaignHistory.archived_cycles.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-[#383c43] bg-[#101318] px-4 py-5 text-sm leading-6 text-[#7f858d]">
                        No archived campaign test cycles yet. Save a campaign learning in Ad Lab, then use Lock & Archive Test Cycle when the readout is final.
                      </div>
                    ) : null}
                  </div>
                  </div>
                </details>

                {/* Contender Watchlist Section */}
                {copyPerformanceMemory.suggestions && copyPerformanceMemory.suggestions.length > 0 ? (
                  <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-5 sm:px-5">
                    <div>
                      <p className={pageLabelClass}>Testing Backlog</p>
                      <h3 className="mt-2 text-xl font-semibold text-[#efe7db] flex items-center gap-1.5">
                        <Sparkles size={18} className="text-amber-400" />
                        Contender Watchlist
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#8a9098]">
                        Low-data or starved candidates worth retesting after the primary direction is set.
                      </p>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {copyPerformanceMemory.suggestions.map((suggest, index) => {
                        const contenderBadge = getContenderBadge(suggest);
                        const contenderLabel = getContenderLabel(suggest);

                        return (
                          <div
                            key={`${suggest.type}-${index}`}
                            className={`rounded-[20px] border p-4 flex flex-col justify-between ${
                              suggest.type === "data-quality-warning"
                                ? "border-amber-800/40 bg-amber-950/10 text-[#f2e5d1]"
                                : "border-emerald-800/40 bg-emerald-950/10 text-[#d1f2e5]"
                            }`}
                          >
                            <div>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">
                                    {contenderLabel}
                                  </span>
                                  <span className="rounded-full border border-[#3f4650] bg-[#161a20] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#c4cad2]">
                                    {contenderBadge}
                                  </span>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                    suggest.confidence === "High"
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : suggest.confidence === "Moderate"
                                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                      : suggest.confidence === "Directional"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      : "bg-[#252a31] text-muted border border-muted/20"
                                  }`}
                                >
                                  {suggest.confidence}
                                </span>
                              </div>

                              <h4 className="mt-3 text-base font-semibold leading-5 text-[#efe7db]">
                                {suggest.action}
                              </h4>
                              <p className="mt-2 text-xs leading-5 text-[#8a9098] opacity-85">
                                {suggest.reason}
                              </p>
                              {suggest.alignmentNote ? (
                                <p className="mt-3 rounded-[14px] border border-[#3b4d3f] bg-[#122018] px-3 py-2 text-xs font-semibold leading-5 text-[#9be3b8]">
                                  {suggest.alignmentNote}
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#31353b]/40 flex justify-between items-center text-[10px] opacity-75">
                              <span className="font-mono truncate max-w-[200px]" title={suggest.evidence}>
                                {suggest.evidence}
                              </span>
                              <span className="italic">Backlog: {suggest.type.replace(/-/g, " ")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-[18px] border border-[#3a3324] bg-[#191713] p-4 text-xs text-[#d7b45e] leading-5">
                      <strong>Causal Caveat:</strong> Correlation-only. Run these as controlled retests, not proof.
                    </div>
                  </div>
                ) : null}

                <PerformanceMemorySection
                  adMetrics={adMetrics}
                  timeline={adPerformanceTimeline}
                  creativeMemory={creativePerformanceMemory}
                  copyMemory={copyPerformanceMemory}
                  campaignControlAd={recommendation.controlAd}
                />

                {!adMetrics.has_data ? (
                  <div className="rounded-[22px] border border-dashed border-[#383c43] bg-[#121418] px-4 py-5 text-sm text-[#7f858d]">
                    No ad data has been imported for this release yet.
                  </div>
                ) : (
                <div className="space-y-6">
                  {/* Campaign Learning */}
                  <form className="space-y-4 pt-2" onSubmit={handleLearningSave}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className={pageLabelClass}>Campaign Learning</p>
                      <button
                        type="button"
                        onClick={handleGenerateDraft}
                        className="flex items-center gap-2 rounded-full bg-[#20242b] px-3 py-1.5 text-xs font-medium text-[#f0eadf] transition hover:bg-[#2a2f38]"
                      >
                        <Sparkles size={14} />
                        Draft From Current Snapshot
                      </button>
                    </div>
                    
                    <div className="rounded-[22px] border border-[#31353b] bg-[#14171b] p-5">
                      <div className="mb-5 rounded-[16px] border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs leading-5 text-blue-200">
                        Draft is based on current Ad Lab data. Review before saving.
                      </div>
                      
                      <div className="space-y-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[#7f858d]">Campaign Summary</span>
                          <textarea
                            className="w-full resize-none rounded-[14px] border border-[#31353b] bg-[#1a1d23] px-3 py-2 text-sm text-[#ede7dc] outline-none transition focus:border-[#424852] focus:bg-[#20242b]"
                            rows={3}
                            value={learningDraft.summary}
                            onChange={(e) => setLearningDraft(curr => ({...curr, summary: e.target.value}))}
                          />
                        </label>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-[#7f858d]">What Worked</span>
                            <textarea
                              className="w-full resize-none rounded-[14px] border border-[#31353b] bg-[#1a1d23] px-3 py-2 text-sm text-[#ede7dc] outline-none transition focus:border-[#424852] focus:bg-[#20242b]"
                              rows={3}
                              value={learningDraft.what_worked}
                              onChange={(e) => setLearningDraft(curr => ({...curr, what_worked: e.target.value}))}
                            />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-[#7f858d]">What Failed</span>
                            <textarea
                              className="w-full resize-none rounded-[14px] border border-[#31353b] bg-[#1a1d23] px-3 py-2 text-sm text-[#ede7dc] outline-none transition focus:border-[#424852] focus:bg-[#20242b]"
                              rows={3}
                              value={learningDraft.what_failed}
                              onChange={(e) => setLearningDraft(curr => ({...curr, what_failed: e.target.value}))}
                            />
                          </label>
                        </div>
                        
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[#7f858d]">Next Test</span>
                          <textarea
                            className="w-full resize-none rounded-[14px] border border-[#31353b] bg-[#1a1d23] px-3 py-2 text-sm text-[#ede7dc] outline-none transition focus:border-[#424852] focus:bg-[#20242b]"
                            rows={2}
                            value={learningDraft.next_test}
                            onChange={(e) => setLearningDraft(curr => ({...curr, next_test: e.target.value}))}
                          />
                        </label>

                        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
                          <label className="space-y-1.5">
                            <span className="text-xs font-medium text-[#7f858d]">Decision</span>
                            <select
                              className="block rounded-[14px] border border-[#31353b] bg-[#1a1d23] px-3 py-2 text-sm text-[#ede7dc] outline-none transition focus:border-[#424852]"
                              value={learningDraft.decision}
                              onChange={(e) => setLearningDraft(curr => ({...curr, decision: e.target.value as AdCampaignDecision}))}
                            >
                              {decisionOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>

                          <div className="flex items-center gap-3">
                            {latestAdLearning?.updated_at && (
                              <span className="text-xs text-[#7f858d]">
                                Last saved: {formatTimestamp(latestAdLearning.updated_at)}
                              </span>
                            )}
                            <button
                              type="submit"
                              disabled={isSavingLearning}
                              className="flex items-center gap-2 rounded-full bg-[#f0eadf] px-4 py-2 text-sm font-semibold text-[#09120b] transition hover:bg-white disabled:opacity-50"
                            >
                              <Save size={16} />
                              {isSavingLearning ? "Saving..." : "Save Learning"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>

                  {/* Batch History */}
                  <details className="group space-y-3 pt-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[#ede7dc] outline-none hover:text-white">
                      <span>Import History ({adMetrics.batch_count} batches)</span>
                      <span className="text-[#7f858d] transition-transform duration-200 group-open:rotate-180">
                        <ChevronDown size={18} />
                      </span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {adMetrics.batches.map((batch) => (
                        <Link 
                          key={batch.id} 
                          href={`/admin/ad-lab/${batch.id}`}
                          className="flex items-center justify-between rounded-[18px] border border-[#31353b] bg-[#14171b] px-4 py-3 text-sm transition hover:border-[#424852] hover:bg-[#1a1d23]"
                        >
                          <div>
                            <p className="font-medium text-[#ede7dc]">{batch.name}</p>
                            <p className="mt-0.5 text-[#7f858d]">
                              {formatTimestamp(batch.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-[#ede7dc]">{formatCurrency(batch.spend)}</p>
                            <p className="mt-0.5 text-[#7f858d]">{batch.report_count} ads</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </details>
                </div>
              )}
              </>
            </section>

            <section className={`${pagePanelClass} scroll-mt-36 space-y-6 px-4 py-5 sm:px-6 sm:py-6`} id="playlists">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#272b31] pb-4">
                <div>
                  <p className={pageLabelClass}>Playlist Campaigns</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                    Playlist Memberships
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a9098]">
                    Configure which streaming playlists this release belongs to, target destination links, and order positions.
                  </p>
                </div>
                {/* Select playlist to add */}
                <div className="flex items-center gap-2">
                  <select
                    className="field-input py-1.5 px-3 bg-[#101215] text-sm text-[#ece6da]"
                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                    value={selectedPlaylistId}
                  >
                    <option value="">Select Playlist...</option>
                    {initialPlaylists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="action-button-primary py-1.5 text-sm inline-flex items-center gap-1"
                    onClick={handleAddPlaylistMembership}
                    type="button"
                  >
                    Add to Playlist
                  </button>
                </div>
              </div>

              {playlistMessage && (
                <div className="rounded-xl border border-emerald-950 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-400">
                  {playlistMessage}
                </div>
              )}

              {playlistError && (
                <div className="rounded-xl border border-rose-950 bg-rose-950/20 px-4 py-3 text-sm text-rose-400">
                  {playlistError}
                </div>
              )}

              <div className="space-y-4">
                {playlistMemberships.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#383c43] bg-[#121418] px-4 py-5 text-sm text-[#7f858d] text-center">
                    This release does not belong to any playlists. Add it using the selector above.
                  </div>
                ) : (
                  playlistMemberships.map((m) => {
                    const playlistObj = initialPlaylists.find((p) => p.id === m.playlistId);
                    const playlistName = playlistObj ? playlistObj.name : "Unknown Playlist";
                    const playlistSlug = playlistObj ? playlistObj.slug : "";

                    return (
                      <div
                        className="rounded-2xl border border-[#31353b] bg-[#14171b] p-4 space-y-4"
                        key={m.playlistId}
                      >
                        <div className="flex items-center justify-between gap-4 border-b border-[#272b31] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#ede7dc]">{playlistName}</span>
                            <span className="text-xs text-muted font-mono">({playlistSlug})</span>
                          </div>
                          <button
                            className="p-1 rounded bg-[#2c1313] text-[#e89182] hover:bg-rose-950/40 transition text-xs px-2"
                            onClick={() => handleRemovePlaylistMembership(m.playlistId)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>

                        {/* target links */}
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-muted">Spotify Track Target</label>
                            <input
                              className="field-input mt-1.5 w-full text-xs font-mono py-1 px-2"
                              onChange={(e) =>
                                handleUpdatePlaylistTargetUrl(m.playlistId, "spotifyTargetUrl", e.target.value)
                              }
                              placeholder="https://open.spotify.com/..."
                              value={m.spotifyTargetUrl}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-muted">Apple Music Target</label>
                            <input
                              className="field-input mt-1.5 w-full text-xs font-mono py-1 px-2"
                              onChange={(e) =>
                                handleUpdatePlaylistTargetUrl(m.playlistId, "appleTargetUrl", e.target.value)
                              }
                              placeholder="https://music.apple.com/..."
                              value={m.appleTargetUrl}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-muted">YouTube Target</label>
                            <input
                              className="field-input mt-1.5 w-full text-xs font-mono py-1 px-2"
                              onChange={(e) =>
                                handleUpdatePlaylistTargetUrl(m.playlistId, "youtubeTargetUrl", e.target.value)
                              }
                              placeholder="https://youtube.com/..."
                              value={m.youtubeTargetUrl}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-1">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              checked={m.isActive}
                              className="sr-only peer"
                              onChange={() => handleTogglePlaylistActive(m.playlistId)}
                              type="checkbox"
                            />
                            <div className="w-8 h-4 bg-[#272b31] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#ece6da] after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#c9a347]"></div>
                            <span className="ml-2 text-xs text-muted">Active in playlist</span>
                          </label>
                          <span className="text-xs text-muted">
                            Order Position: <span className="font-mono bg-[#1b1e24] px-1.5 py-0.5 rounded">#{m.position + 1}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {playlistMemberships.length > 0 && (
                <div className="pt-4 border-t border-[#272b31] flex justify-end">
                  <button
                    className="action-button-primary py-2 text-sm"
                    disabled={isSavingPlaylists}
                    onClick={handleSavePlaylistMemberships}
                    type="button"
                  >
                    {isSavingPlaylists ? "Saving Memberships..." : "Save Playlist Memberships"}
                  </button>
                </div>
              )}
            </section>

          </div>

          <aside className="scroll-mt-36 xl:sticky xl:top-[112px] xl:self-start" id="release-actions">
            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={pageLabelClass}>Release Control Panel</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#f0eadf]">
                    At a glance
                  </h2>
                </div>
                <span className={pageAccentPillClass}>{saveStatusLabel}</span>
              </div>

              <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={pageLabelClass}>Internal Progress</p>
                  <span className={pageAccentPillClass}>{progress}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#23262c]">
                  <div
                    className={`h-full rounded-full ${getReleaseProgressTone(progress)}`}
                    style={{width: `${progress}%`}}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#8a9098]">Stage</span>
                    <span className="text-right font-semibold text-[#efe8db]">{snapshotStage}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#8a9098]">Tasks</span>
                    <span className="font-semibold text-[#efe8db]">
                      {openTasks.length} open / {completedTaskCount} done
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4 text-sm">
                <p className={pageLabelClass}>Next Action</p>
                <p className="mt-2 leading-6 text-[#efe8db]">{snapshotNextAction}</p>
              </div>

              {snapshotBlockers.length > 0 ? (
                <div className="rounded-[20px] border border-[#5a312d] bg-[#1c1313] px-4 py-4">
                  <p className={pageLabelClass}>Blockers</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {snapshotBlockers.map((blocker) => (
                      <span
                        className="inline-flex items-center rounded-full border border-[#6c3934] bg-[#251515] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d4a7a0]"
                        key={blocker}
                      >
                        {blocker}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className={pageLabelClass}>Public + Discovery</p>
                  <span className={isPublishReady ? pageAccentPillClass : pagePillClass}>
                    {isPublishReady ? "Publish Ready" : "Blocked"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={release.is_published ? pageAccentPillClass : pagePillClass}>
                    {release.is_published ? "Visible" : "Hidden"}
                  </span>
                  <span className={discoveryReadinessLabel === "Ready" ? pageAccentPillClass : pagePillClass}>
                    Discovery: {discoveryReadinessLabel}
                  </span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-[#8a9098]">
                  {publicUrlPreview}
                </p>
              </div>

              <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4 text-sm text-[#aeb3bb]">
                <p className={pageLabelClass}>Metadata</p>
                <div className="mt-3 space-y-2">
                  {[
                    ["Type", formatReleaseType(release.type)],
                    ["Release Date", release.release_date || "Not set"],
                    ["Collaborators", release.collaborator ? formatCollaboratorsList(release.collaborator_name) || "Yes" : "No"],
                    ["UPC", release.upc || "Not set"],
                    ["ISRC", release.isrc || "Not set"],
                    ["Updated", formatTimestamp(release.updated_on)]
                  ].map(([label, value]) => (
                    <div className="flex items-start justify-between gap-3" key={label}>
                      <span className="text-xs uppercase tracking-[0.14em] text-[#7b8088]">{label}</span>
                      <span className="text-right text-[#ebe4d8]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4">
                <p className={pageLabelClass}>Streaming</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {streamingMetadataButtons.map((platform) => {
                    const Icon = platform.icon;

                    if (!platform.href) {
                      return (
                        <span
                          className="inline-flex items-center gap-2 rounded-full border border-[#30343b] bg-[#101318] px-3 py-2 text-xs font-semibold text-[#727780]"
                          key={platform.label}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {platform.label}: Not set
                        </span>
                      );
                    }

                    return (
                      <a
                        className="inline-flex items-center gap-2 rounded-full border border-[#3f4637] bg-[#171a12] px-3 py-2 text-xs font-semibold text-[#f0d98b] transition hover:border-[#d7b45e]/50 hover:text-[#ffe2a5]"
                        href={platform.href}
                        key={platform.label}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {platform.label}
                      </a>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[20px] border border-[#31353b] bg-[#121418] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className={pageLabelClass}>Tasks</p>
                  <span className={pagePillClass}>{release.tasks.length} total</span>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    className={`${pageInputClass} py-2.5`}
                    onChange={(event) => setTaskText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTask();
                      }
                    }}
                    placeholder="Add a task"
                    value={taskText}
                  />
                  <button className={`${pagePrimaryButtonClass} px-3`} onClick={addTask} type="button">
                    <Plus size={16} />
                  </button>
                </div>

                <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {release.tasks.map((task) => (
                    <div
                      className={`flex items-start gap-2 rounded-[16px] border px-3 py-2 ${
                        task.completed
                          ? "border-[#353941] bg-[#101318]"
                          : "border-[#31353b] bg-[#15181c]"
                      }`}
                      key={task.id}
                    >
                      <input
                        checked={task.completed}
                        className={`${pageCheckboxClass} mt-0.5 shrink-0`}
                        onChange={(event) =>
                          updateRelease((current) => ({
                            ...current,
                            tasks: current.tasks.map((item) =>
                              item.id === task.id
                                ? {
                                    ...item,
                                    completed: event.target.checked
                                  }
                                : item
                            )
                          }))
                        }
                        type="checkbox"
                      />
                      <span
                        className={`min-w-0 flex-1 text-sm leading-5 ${
                          task.completed
                            ? "text-[#727780] line-through"
                            : "text-[#e7e1d6]"
                        }`}
                      >
                        {task.text}
                      </span>
                      <button
                        aria-label={`Delete task: ${task.text}`}
                        className="rounded-full border border-[#4a2b2b] bg-[#251515] p-1.5 text-[#d4a7a0] transition hover:border-[#7b3e3e] hover:bg-[#341919]"
                        onClick={() => handleDeleteTask(task.id)}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {release.tasks.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[#383c43] bg-[#101318] px-3 py-4 text-sm text-[#7f858d]">
                      No tasks yet. Add the next concrete action here.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>
        </section>

        <StickyActionDock
          isVisible={true}
          variant="editor"
          statusSlot={
            message ? (
              <span
                className={`rounded-full border px-4 py-2 text-sm ${
                  isErrorMessage
                    ? "border-[#5a312d] bg-[#1c1313] text-[#d4a7a0]"
                    : "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                }`}
              >
                {message}
              </span>
            ) : (
              <span className="pill text-xs">{saveStatusLabel}</span>
            )
          }
          secondaryActionsSlot={
            <div className="flex items-center gap-2">
              <Link className={pageTertiaryButtonClass} href="/admin/releases">
                <ArrowLeft size={16} />
                Back
              </Link>
              <button
                className={pageDangerButtonClass}
                disabled={isDeleting}
                onClick={() => void handleDeleteRelease()}
                type="button"
              >
                <Trash2 size={16} />
                Delete Release
              </button>
            </div>
          }
          primaryActionSlot={
            <button
              className={hasPendingChanges ? pagePrimaryButtonClass : pageSecondaryButtonClass}
              disabled={saveState === "saving" || !hasPendingChanges}
              onClick={() => void handleManualSave()}
              type="button"
            >
              <Save size={16} />
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>
          }
        >
          <nav
            aria-label="Release detail sections"
            className="mobile-scroll-x order-3 flex w-full items-center gap-2 lg:order-none lg:w-auto"
          >
            {[
              {href: "#overview", label: "Overview"},
              {href: "#discovery", label: "Discovery"},
              {href: "#media", label: "Media"},
              {href: "#promo-summary", label: "Promo"},
              {href: "#playlists", label: "Playlists"},
              {href: "#release-actions", label: "Actions"}
            ].map((item) => (
              <a
                className="shrink-0 rounded-full border border-[#30343b] bg-[#15181c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d5d9df] transition hover:border-[#d7b45e]/45 hover:text-[#f1dfad]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </StickyActionDock>
      </div>
    </main>
  );
}
