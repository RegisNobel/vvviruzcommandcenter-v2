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
import {
  ArrowLeft,
  Captions,
  Check,
  FolderOpen,
  ImagePlus,
  Lock,
  Link2Off,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Unlock
} from "lucide-react";

import {AUTOSAVE_INTERVAL_MS} from "@/lib/constants";
import {
  calculateReleaseProgress,
  createReleaseTask,
  getReleasePublishBlockers,
  getReleaseProgressTone,
  getReleaseStageLabel,
  hasReleaseCoverArt,
  getSuggestedReleaseSlug
} from "@/lib/releases";
import {
  formatContentType,
  formatHookType,
  formatSongSection,
  getCopyHeading
} from "@/lib/copy";
import type {ReleaseChecklistKey} from "@/lib/releases";
import type {
  CopySummary,
  AdCampaignLearningRecord,
  ReleaseCoverUploadResponse,
  ReleaseRecord,
  ReleaseStageLabel,
  ReleaseType
} from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

type ReleaseFlowStageDefinition = {
  id: ReleaseChecklistKey | "cover_art";
  checkboxKey?: ReleaseChecklistKey;
  label: Exclude<ReleaseStageLabel, "Not Started">;
  isComplete: (release: ReleaseRecord) => boolean;
  getRequirements: (
    release: ReleaseRecord
  ) => Array<{blocker: string; nextAction: string}>;
};

const releaseFlowStages: ReleaseFlowStageDefinition[] = [
  {
    id: "concept_complete",
    checkboxKey: "concept_complete",
    label: "Concept",
    isComplete: (release) => release.concept_complete,
    getRequirements: (release) =>
      release.concept_details.trim()
        ? []
        : [
            {
              blocker: "Missing concept details",
              nextAction: "Add concept details"
            }
          ]
  },
  {
    id: "cover_art",
    label: "Cover Art",
    isComplete: hasReleaseCoverArt,
    getRequirements: (release) =>
      hasReleaseCoverArt(release)
        ? []
        : [
            {
              blocker: "Missing cover art",
              nextAction: "Upload cover art"
            }
          ]
  },
  {
    id: "beat_made",
    checkboxKey: "beat_made",
    label: "Beat Made",
    isComplete: (release) => release.beat_made,
    getRequirements: () => []
  },
  {
    id: "lyrics_finished",
    checkboxKey: "lyrics_finished",
    label: "Lyrics",
    isComplete: (release) => release.lyrics_finished,
    getRequirements: (release) =>
      release.lyrics.trim()
        ? []
        : [
            {
              blocker: "Missing lyrics",
              nextAction: "Add lyrics"
            }
          ]
  },
  {
    id: "recorded",
    checkboxKey: "recorded",
    label: "Recorded",
    isComplete: (release) => release.recorded,
    getRequirements: () => []
  },
  {
    id: "mix_mastered",
    checkboxKey: "mix_mastered",
    label: "Mix/Mastered",
    isComplete: (release) => release.mix_mastered,
    getRequirements: () => []
  },
  {
    id: "published",
    checkboxKey: "published",
    label: "Published",
    isComplete: (release) => release.published,
    getRequirements: (release) => {
      const requirements: Array<{blocker: string; nextAction: string}> = [];

      if (release.collaborator && !release.collaborator_name.trim()) {
        requirements.push({
          blocker: "Missing collaborator name",
          nextAction: "Add collaborator name"
        });
      }

      if (!release.release_date.trim()) {
        requirements.push({
          blocker: "Missing release date",
          nextAction: "Add release date"
        });
      }

      return requirements;
    }
  }
];

function getCurrentSnapshotStageDefinition(release: ReleaseRecord) {
  return (
    releaseFlowStages.find((stage) => !stage.isComplete(release)) ??
    releaseFlowStages[releaseFlowStages.length - 1]
  );
}

function getSnapshotValidationWarnings(release: ReleaseRecord) {
  return releaseFlowStages.flatMap((stage) => {
    if (!stage.checkboxKey || !stage.isComplete(release)) {
      return [];
    }

    return stage.getRequirements(release).map(
      (requirement) => `${stage.label} validation warning: ${requirement.blocker}`
    );
  });
}

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

function formatReleaseType(value: ReleaseType) {
  return value === "mainstream" ? "Mainstream" : "Nerdcore";
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

function getSnapshotStage(release: ReleaseRecord) {
  return getReleaseStageLabel(release);
}

function getSnapshotNextAction(release: ReleaseRecord) {
  const currentStage = getCurrentSnapshotStageDefinition(release);
  const requirements = currentStage.getRequirements(release);

  if (requirements.length > 0) {
    return requirements[0].nextAction;
  }

  if (currentStage.checkboxKey && !currentStage.isComplete(release)) {
    return `Mark ${currentStage.label} complete`;
  }

  return "No action needed";
}

function getSnapshotBlockers(release: ReleaseRecord) {
  const currentStage = getCurrentSnapshotStageDefinition(release);
  const currentStageRequirements = currentStage.getRequirements(release);
  const blockers = [...getSnapshotValidationWarnings(release)];

  if (currentStageRequirements.length > 0) {
    blockers.push(...currentStageRequirements.map((requirement) => requirement.blocker));
    return blockers;
  }

  if (currentStage.checkboxKey && !currentStage.isComplete(release)) {
    blockers.push(`${currentStage.label} approval pending`);
  }

  return blockers;
}

const orderedCheckboxStageKeys = releaseFlowStages.flatMap((stage) =>
  stage.checkboxKey ? [stage.checkboxKey] : []
);

function getStageUnlockReason(release: ReleaseRecord, key: ReleaseChecklistKey) {
  const stageIndex = releaseFlowStages.findIndex((stage) => stage.checkboxKey === key);

  if (stageIndex <= 0) {
    return null;
  }

  const blockingStage = releaseFlowStages
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

const pageShellClass =
  "min-h-[calc(100vh-81px)] bg-[#0f1114] text-[#e7e2d8]";
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

export function ReleaseDetailEditor({
  initialLinkedCopies,
  initialRelease,
  latestAdLearning
}: {
  initialLinkedCopies: CopySummary[];
  initialRelease: ReleaseRecord;
  latestAdLearning: AdCampaignLearningRecord | null;
}) {
  const router = useRouter();
  const [release, setRelease] = useState(initialRelease);
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

  const progress = useMemo(() => calculateReleaseProgress(release), [release]);
  const snapshotStage = useMemo(() => getSnapshotStage(release), [release]);
  const currentStage = snapshotStage;
  const snapshotNextAction = useMemo(() => getSnapshotNextAction(release), [release]);
  const snapshotBlockers = useMemo(() => getSnapshotBlockers(release), [release]);
  const suggestedSlug = useMemo(
    () => getSuggestedReleaseSlug(release.title),
    [release.title]
  );
  const publishBlockers = useMemo(
    () => getReleasePublishBlockers(release),
    [release]
  );
  const isPublishReady = publishBlockers.length === 0;
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
    const snapshot = serializeRelease(releaseToSave);
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
    updateRelease((current) => {
      const nextRelease = {
        ...current,
        [key]: checked
      };

      if (checked) {
        return nextRelease;
      }

      const keyIndex = orderedCheckboxStageKeys.indexOf(key);

      for (const downstreamKey of orderedCheckboxStageKeys.slice(keyIndex + 1)) {
        nextRelease[downstreamKey] = false;
      }

      return nextRelease;
    });
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

      const response = await fetch("/api/releases/cover-upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as {
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
                Keep the release organized with collaborator info, UPC and ISRC
                metadata, lyrics, cover art, stage completion, and a simple working
                task list.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#31353b] bg-[#111317] p-4 sm:p-5">
              <div className="rounded-[22px] border border-[#3a3f46] bg-[#16191d] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={pageLabelClass}>Progress</p>
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
                    <span>Collaborator</span>
                    <span className="font-semibold text-[#efe8db]">
                      {release.collaborator
                        ? release.collaborator_name || "Yes"
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

        <section className={`${pagePanelClass} px-4 py-5 sm:px-6`}>
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
              <p className={pageLabelClass}>Release Snapshot</p>
              <p className="mt-3 text-sm text-[#8b9199]">Current Stage</p>
              <div className="mt-3">
                <span className={pageAccentPillClass}>{snapshotStage}</span>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
              <p className={pageLabelClass}>Next Action</p>
              <p className="mt-3 text-lg font-semibold text-[#efe8db]">
                {snapshotNextAction}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#8b9199]">
                Computed from the current stage checklist and release assets already on
                this record.
              </p>
            </div>

            <div className="rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4">
              <p className={pageLabelClass}>Blockers</p>
              {snapshotBlockers.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {snapshotBlockers.map((blocker) => (
                    <span
                      className="inline-flex items-center rounded-full border border-[#5a312d] bg-[#1c1313] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#d4a7a0]"
                      key={blocker}
                    >
                      {blocker}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-lg font-semibold text-[#efe8db]">No blockers</p>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className={pageTertiaryButtonClass} href="/admin/releases">
            <ArrowLeft size={16} />
            Back to Releases
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className={hasPendingChanges ? pagePrimaryButtonClass : pageSecondaryButtonClass}
              disabled={saveState === "saving" || !hasPendingChanges}
              onClick={() => void handleManualSave()}
              type="button"
            >
              <Save size={16} />
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>

            <button
              className={pageDangerButtonClass}
              disabled={isDeleting}
              onClick={() => void handleDeleteRelease()}
              type="button"
            >
              <Trash2 size={16} />
              {isDeleting ? "Deleting..." : "Delete Release"}
            </button>

            {message ? (
              <span
                className={`rounded-full border px-4 py-2 text-sm ${
                  isErrorMessage
                    ? "border-[#5a312d] bg-[#1c1313] text-[#d4a7a0]"
                    : "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                }`}
              >
                {message}
              </span>
            ) : null}
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className={`${pagePanelClass} space-y-5 px-4 py-5 sm:px-6 sm:py-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={pageLabelClass}>Section 1</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Basic Info</h2>
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
                  <span className={pageLabelClass}>Type</span>
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
                  <span className={pageLabelClass}>Collaborator</span>
                  <select
                    className={pageInputClass}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        collaborator: event.target.value === "yes",
                        collaborator_name:
                          event.target.value === "yes"
                            ? current.collaborator_name
                            : ""
                      }))
                    }
                    value={release.collaborator ? "yes" : "no"}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>

                {release.collaborator ? (
                  <label className="space-y-2">
                    <span className={pageLabelClass}>Collaborator Name</span>
                    <input
                      className={pageInputClass}
                      onChange={(event) =>
                        updateRelease((current) => ({
                          ...current,
                          collaborator_name: event.target.value
                        }))
                      }
                      placeholder="Who is the collaborator?"
                      value={release.collaborator_name}
                    />
                  </label>
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

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Section 2</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Public Site
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  These fields drive the public website. Internal stage completion
                  and public visibility stay separate on purpose.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={pageLabelClass}>Slug</span>
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
                </div>

                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Public Description</span>
                  <textarea
                    className={`${pageInputClass} min-h-[120px]`}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        public_description: event.target.value
                      }))
                    }
                    placeholder="Short public description for cards, hero sections, and metadata."
                    value={release.public_description}
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className={pageLabelClass}>Public Long Description</span>
                  <textarea
                    className={`${pageInputClass} min-h-[160px]`}
                    onChange={(event) =>
                      updateRelease((current) => ({
                        ...current,
                        public_long_description: event.target.value
                      }))
                    }
                    placeholder="Optional longer release-page description."
                    value={release.public_long_description}
                  />
                </label>

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
                    Show lyrics publicly
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[#8a9098]">
                    Turn this on only when you want the full lyrics visible on the
                    public release page.
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
                          Visible on the public site
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-[#bda980]">
                          This controls public visibility under `/`, `/music`,
                          `/about`, and `/links`. It does not change the internal
                          release stage checklist.
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
                        ? "Publish-ready"
                        : "Public publish blockers"}
                    </p>
                    {isPublishReady ? (
                      <p className="mt-2 leading-6 text-emerald-100/85">
                        Core public fields are in place. You can safely mark this
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
              </div>
            </section>

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Section 3</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Concept Details
                </h2>
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

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Section 4</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Cover Art</h2>
              </div>

              {release.cover_art ? (
                <div className="overflow-hidden rounded-[24px] border border-[#30343b] bg-[#111318]">
                  <div className="relative aspect-square w-full max-w-md">
                    <Image
                      alt={`${release.title} cover art`}
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
                  className={pagePrimaryButtonClass}
                  href={`/admin/photo-lab?releaseId=${release.id}`}
                >
                  <Sparkles size={16} />
                  Create Cover Art
                </Link>

                <label className={pageSecondaryButtonClass}>
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
                <p className={pageLabelClass}>Section 5</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Lyrics</h2>
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
                <p className={pageLabelClass}>Section 6</p>
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
                {releaseFlowStages.map((stage) => {
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
                  const isDisabled = !release[stage.checkboxKey] && Boolean(unlockReason);
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
                <p className={pageLabelClass}>Section 7</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Streaming Links
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Leave these blank until the release is live, then drop in the
                  platform URLs when they are ready.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
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

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Section 8</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                  Copy Pairs
                </h2>
                <p className="mt-2 text-sm text-[#8a9098]">
                  Any Copy Lab entry attached to this release appears here automatically.
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
                            {formatContentType(linkedCopy.content_type)}
                          </span>
                          <span className={pagePillClass}>
                            {formatSongSection(linkedCopy.song_section)}
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

            <section className={`${pagePanelClass} space-y-4 px-4 py-5 sm:px-6 sm:py-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={pageLabelClass}>Ads Analytics</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">
                    Campaign Learning
                  </h2>
                </div>
                <Link className={pageSecondaryButtonClass} href={`/admin/ads?releaseId=${release.id}`}>
                  Open Ads
                </Link>
              </div>

              {latestAdLearning ? (
                <div className="rounded-[22px] border border-[#31353b] bg-[#14171b] p-4 text-sm leading-6 text-[#aeb3bb]">
                  <div className="flex flex-wrap gap-2">
                    <span className={pagePillClass}>
                      Decision: {latestAdLearning.decision}
                    </span>
                    <span className={pagePillClass}>
                      Updated {formatTimestamp(latestAdLearning.updated_at)}
                    </span>
                  </div>
                  <p className="mt-4 text-[#ede7dc]">
                    {latestAdLearning.summary || "No summary written yet."}
                  </p>
                  {latestAdLearning.next_test ? (
                    <p className="mt-3">
                      <span className={pageLabelClass}>Next Test</span>
                      <span className="mt-1 block text-[#ede7dc]">
                        {latestAdLearning.next_test}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#383c43] bg-[#121418] px-4 py-5 text-sm text-[#7f858d]">
                  No Ads Analytics learning is saved for this release yet.
                </div>
              )}
            </section>

          </div>

          <aside className="space-y-6">
            <section className={`${pagePanelClass} space-y-5 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Record Info</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Metadata</h2>
              </div>

              <div className="space-y-3 rounded-[22px] border border-[#31353b] bg-[#121418] px-4 py-4 text-sm text-[#aeb3bb]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={pageLabelClass}>ID</span>
                  <span className="font-mono text-xs text-[#f0eadf]">{release.id}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={pageLabelClass}>Created On</span>
                  <span className="text-right text-[#ebe4d8]">
                    {formatTimestamp(release.created_on)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={pageLabelClass}>UPC</span>
                  <span className="text-right text-[#ebe4d8]">
                    {release.upc || "Not set"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={pageLabelClass}>ISRC</span>
                  <span className="text-right text-[#ebe4d8]">
                    {release.isrc || "Not set"}
                  </span>
                </div>
                <div className="space-y-2 border-t border-[#2d3138] pt-3">
                  <span className={pageLabelClass}>Streaming</span>
                  <div className="grid gap-2">
                    {streamingMetadataButtons.map((platform) => {
                      const Icon = platform.icon;
                      const buttonClassName = `inline-flex w-full rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        platform.href
                          ? platform.activeClassName
                          : platform.inactiveClassName
                      }`;

                      if (!platform.href) {
                        return (
                          <div
                            className={`${buttonClassName} items-center justify-between gap-3`}
                            key={platform.label}
                          >
                            <span className="flex flex-wrap items-center gap-3">
                              <Icon className="h-5 w-5 shrink-0" />
                              {platform.label}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                              Not set
                            </span>
                          </div>
                        );
                      }

                      return (
                        <a
                          className={`${buttonClassName} items-center gap-3`}
                          href={platform.href}
                          key={platform.label}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {platform.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={pageLabelClass}>Updated On</span>
                  <span className="text-right text-[#ebe4d8]">
                    {formatTimestamp(release.updated_on)}
                  </span>
                </div>
              </div>
            </section>

            <section className={`${pagePanelClass} space-y-5 px-4 py-5 sm:px-6 sm:py-6`}>
              <div>
                <p className={pageLabelClass}>Section 10</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#f0eadf]">Tasks</h2>
              </div>

              <div className="flex gap-3">
                <input
                  className={pageInputClass}
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
                <button className={pagePrimaryButtonClass} onClick={addTask} type="button">
                  <Plus size={16} />
                  Add
                </button>
              </div>

              <div className="space-y-3">
                {release.tasks.map((task) => (
                  <div
                    className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 ${
                      task.completed
                        ? "border-[#353941] bg-[#121418]"
                        : "border-[#31353b] bg-[#15181c]"
                    }`}
                    key={task.id}
                  >
                    <input
                      checked={task.completed}
                      className={pageCheckboxClass}
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
                      className={`flex-1 text-sm ${
                        task.completed
                          ? "text-[#727780] line-through"
                          : "text-[#e7e1d6]"
                      }`}
                    >
                      {task.text}
                    </span>
                    <button
                      className={pageDangerButtonClass}
                      onClick={() => handleDeleteTask(task.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                ))}

                {release.tasks.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#383c43] bg-[#121418] px-4 py-5 text-sm text-[#7f858d]">
                    No tasks yet. Add the next concrete action to keep the release
                    moving.
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
