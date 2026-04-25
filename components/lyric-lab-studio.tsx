"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";
import {ChevronLeft, ChevronRight, Film, Save, Wand2} from "lucide-react";

import {AudioDropzone} from "@/components/audio-dropzone";
import {ExportPanel} from "@/components/export-panel";
import {LivePreview} from "@/components/live-preview";
import {LyricsEditor} from "@/components/lyrics-editor";
import {ProjectLibrary} from "@/components/project-library";
import {ReleaseContextStep} from "@/components/release-context-step";
import {StylePanel} from "@/components/style-panel";
import {TranscriptionStep} from "@/components/transcription-step";
import {TrimEditor} from "@/components/trim-editor";
import {WorkflowStepper} from "@/components/workflow-stepper";
import {AUTOSAVE_INTERVAL_MS, MAX_AUDIO_MS, MIN_LINE_MS} from "@/lib/constants";
import type {
  BackgroundUploadResponse,
  ExportStreamEvent,
  LyricLine,
  LyricProject,
  ProjectSummary,
  ReleaseSummary,
  TranscriptionLanguage,
  TranscriptionResponse,
  UploadResponse,
  WorkflowStep
} from "@/lib/types";
import {stripFileExtension} from "@/lib/utils";
import {
  applyStylePreset,
  createEmptyProject,
  hydrateProject,
  mergeLines,
  normalizeLines,
  replaceAudio,
  splitLine,
  touchProject
} from "@/lib/video/project";
import {linesToSrt} from "@/lib/video/srt";

type TrimRange = {
  startMs: number;
  endMs: number;
};

type ExportState = {
  progress: number;
  stage: string | null;
  isExporting: boolean;
  downloadUrl: string | null;
};

type AutoSaveState = "idle" | "saving" | "saved" | "error";

const workflowOrder: WorkflowStep[] = [
  "context",
  "audio",
  "trim",
  "transcribe",
  "edit",
  "style",
  "export"
];

const stepCopy: Record<
  WorkflowStep,
  {eyebrow: string; title: string; description: string}
> = {
  context: {
    eyebrow: "Step 1",
    title: "Set the project context",
    description:
      "Choose whether this lyric project belongs to an existing release or should stay standalone before the audio workflow begins."
  },
  audio: {
    eyebrow: "Step 2",
    title: "Choose the source clip",
    description:
      "Upload the audio for this video clip. The project is created and saved as soon as the file lands."
  },
  trim: {
    eyebrow: "Step 3",
    title: "Trim to the best 30 seconds",
    description:
      "Longer clips must be cut down before the rest of the workflow unlocks."
  },
  transcribe: {
    eyebrow: "Step 4",
    title: "Auto-transcribe the clip",
    description:
      "Video Lab runs local Whisper with auto, English, French, or Spanish support and saves the synced lyric lines automatically."
  },
  edit: {
    eyebrow: "Step 5",
    title: "Review and fix the transcription",
    description:
      "Clean up text, split or merge lines, and correct timing before you move to styling."
  },
  style: {
    eyebrow: "Step 6",
    title: "Pick the visual treatment",
    description:
      "Choose 9:16 or 16:9, drag the lyric block into place, and tune fonts, motion, and backgrounds."
  },
  export: {
    eyebrow: "Step 7",
    title: "Render the final video",
    description:
      "Choose a resolution, export SRT if you want it, and render the MP4 locally."
  }
};

function serializeProject(project: LyricProject) {
  return JSON.stringify(project);
}

function summarizeProject(project: LyricProject): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    release_id: project.release_id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    hasAudio: Boolean(project.audio),
    durationMs: project.audio?.durationMs ?? null,
    aspectRatio: project.aspectRatio,
    lineCount: project.lines.length,
    workflowStep: project.workflowStep
  };
}

function sortProjectSummaries(projects: ProjectSummary[]) {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getPreviousStep(
  step: WorkflowStep,
  requiresTrim: boolean
): WorkflowStep | null {
  switch (step) {
    case "audio":
      return "context";
    case "trim":
      return "audio";
    case "transcribe":
      return requiresTrim ? "trim" : "audio";
    case "edit":
      return "transcribe";
    case "style":
      return "edit";
    case "export":
      return "style";
    default:
      return null;
  }
}

function createFreshProject(initialReleaseId?: string | null) {
  const nextProject = createEmptyProject();

  return initialReleaseId
    ? {
        ...nextProject,
        release_id: initialReleaseId
      }
    : nextProject;
}

export function LyricLabStudio({
  initialProjectId,
  initialReleaseId
}: {
  initialProjectId?: string | null;
  initialReleaseId?: string | null;
}) {
  const [project, setProject] = useState<LyricProject>(() => {
    return createFreshProject(initialReleaseId);
  });
  const [activeStep, setActiveStep] = useState<WorkflowStep>(project.workflowStep);
  const deferredProject = useDeferredValue(project);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [availableReleases, setAvailableReleases] = useState<ReleaseSummary[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(
    project.lines[0]?.id ?? null
  );
  const [trimRange, setTrimRange] = useState<TrimRange>({
    startMs: 0,
    endMs: MAX_AUDIO_MS
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saveState, setSaveState] = useState<AutoSaveState>("idle");
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialReleaseId
      ? "Release preselected. Review the project context, then continue to audio."
      : "Choose whether to attach this project to a release to begin."
  );
  const [exportState, setExportState] = useState<ExportState>({
    progress: 0,
    stage: null,
    isExporting: false,
    downloadUrl: null
  });
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const latestDraftSnapshotRef = useRef<string>(serializeProject(project));
  const initialProjectLoadRef = useRef<string | null>(null);
  const requiresTrim = Boolean(
    project.audio && !project.audio.trimmed && project.audio.durationMs > MAX_AUDIO_MS
  );
  const canPersistProject = Boolean(project.audio) || project.workflowStep !== "context";
  const saveStatusLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save error"
        : hasPendingChanges
          ? "Unsaved changes"
          : "Saved";

  const refreshProjects = useCallback(async () => {
    const response = await fetch("/api/projects");
    const data = (await response.json()) as {projects: ProjectSummary[]};

    setSavedProjects(sortProjectSummaries(data.projects));
  }, []);

  const refreshReleases = useCallback(async () => {
    const response = await fetch("/api/releases");
    const data = (await response.json()) as {releases: ReleaseSummary[]};

    setAvailableReleases(data.releases);
  }, []);

  const upsertProjectSummary = useCallback((savedProject: LyricProject) => {
    const summary = summarizeProject(savedProject);

    setSavedProjects((currentProjects) => {
      const nextProjects = currentProjects.filter(
        (currentProject) => currentProject.id !== summary.id
      );

      return sortProjectSummaries([summary, ...nextProjects]);
    });
  }, []);

  const persistProject = useCallback(
    async (
      projectToSave: LyricProject,
      options?: {
        successMessage?: string | null;
      }
    ) => {
      const snapshot = serializeProject(projectToSave);
      const previousSnapshot = lastSavedSnapshotRef.current;

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      lastSavedSnapshotRef.current = snapshot;
      setSaveState("saving");

      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(projectToSave)
        });
        const payload = (await response.json()) as {
          project?: LyricProject;
          message?: string;
        };

        if (!response.ok || !payload.project) {
          throw new Error(payload.message ?? "Save failed.");
        }

        const savedProject = hydrateProject(payload.project);
        lastSavedSnapshotRef.current = snapshot;
        upsertProjectSummary(savedProject);
        setSaveState("saved");
        setHasPendingChanges(latestDraftSnapshotRef.current !== snapshot);

        if (options?.successMessage) {
          setMessage(options.successMessage);
        }

        return savedProject;
      } catch (error) {
        lastSavedSnapshotRef.current = previousSnapshot;
        setSaveState("error");
        setHasPendingChanges(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "Autosave failed. Your edits are still in memory."
        );
        throw error;
      }
    },
    [upsertProjectSummary]
  );

  useEffect(() => {
    latestDraftSnapshotRef.current = serializeProject(project);
  }, [project]);

  const runTranscription = useCallback(
    async (audioId: string, language: TranscriptionLanguage) => {
      setIsTranscribing(true);
      setMessage("Running local Whisper transcription and syncing lyric lines...");
      setActiveStep("transcribe");

      startTransition(() => {
        setProject((currentProject) =>
          touchProject({
            ...currentProject,
            workflowStep: currentProject.workflowStep,
            transcriptionStatus: "running"
          })
        );
      });

      try {
        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({audioId, language})
        });
        const payload = (await response.json()) as TranscriptionResponse & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message ?? "Transcription failed.");
        }

        startTransition(() => {
          setProject((currentProject) => {
            const maxDuration = currentProject.audio?.durationMs ?? MAX_AUDIO_MS;
            const nextLines =
              payload.lines.length > 0
                ? normalizeLines(payload.lines, maxDuration)
                : currentProject.lines;

            setSelectedLineId(nextLines[0]?.id ?? null);

            return touchProject({
              ...currentProject,
              lines: nextLines,
              transcriptionStatus: "complete"
            });
          });
        });

        setMessage("Transcription is ready. Review it, then continue to editing.");
      } catch (error) {
        startTransition(() => {
          setProject((currentProject) =>
            touchProject({
              ...currentProject,
              transcriptionStatus: "failed"
            })
          );
        });
        setMessage(
          error instanceof Error ? error.message : "Transcription failed unexpectedly."
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  useEffect(() => {
    void refreshProjects();
    void refreshReleases();
  }, [refreshProjects, refreshReleases]);

  useEffect(() => {
    if (!project.lines.some((line) => line.id === selectedLineId)) {
      setSelectedLineId(project.lines[0]?.id ?? null);
    }
  }, [project.lines, selectedLineId]);

  useEffect(() => {
    if (
      !project.audio &&
      project.workflowStep === "context" &&
      activeStep !== "context"
    ) {
      setActiveStep("context");
      return;
    }

    if (
      !project.audio &&
      project.workflowStep !== "context" &&
      activeStep !== "audio" &&
      activeStep !== "context"
    ) {
      setActiveStep("audio");
    }
  }, [activeStep, project.audio, project.workflowStep]);

  useEffect(() => {
    if (
      !project.audio ||
      activeStep !== "transcribe" ||
      requiresTrim ||
      isTranscribing ||
      project.transcriptionStatus !== "idle"
    ) {
      return;
    }

    void runTranscription(project.audio.id, project.transcriptionLanguage);
  }, [
    activeStep,
    isTranscribing,
    project.audio,
    project.transcriptionLanguage,
    project.transcriptionStatus,
    requiresTrim,
    runTranscription
  ]);

  useEffect(() => {
    if (!canPersistProject) {
      setSaveState("idle");
      return;
    }

    const snapshot = serializeProject(project);

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistProject(project).catch(() => {});
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [canPersistProject, persistProject, project]);

  function updateProject(mutator: (currentProject: LyricProject) => LyricProject) {
    startTransition(() => {
      setProject((currentProject) => touchProject(mutator(currentProject)));
    });
    setHasPendingChanges(true);
  }

  function handleNewProject() {
    const nextProject = createFreshProject(initialReleaseId);

    lastSavedSnapshotRef.current = null;
    setProject(nextProject);
    setActiveStep("context");
    setSelectedLineId(nextProject.lines[0]?.id ?? null);
    setTrimRange({
      startMs: 0,
      endMs: MAX_AUDIO_MS
    });
    setExportState({
      progress: 0,
      stage: null,
      isExporting: false,
      downloadUrl: null
    });
    setSaveState("idle");
    setHasPendingChanges(false);
    setMessage(
      initialReleaseId
        ? "Fresh project ready. The release is preselected for this new clip."
        : "Fresh project ready. Choose whether to attach it to a release before you start."
    );
  }

  async function handleContextContinue() {
    const nextProject = touchProject({
      ...project,
      workflowStep: "audio"
    });

    setProject(nextProject);
    setActiveStep("audio");
    setMessage(
      nextProject.release_id
        ? "Project attached to the selected release. Upload audio to continue."
        : "Standalone project ready. Upload audio to continue."
    );

    try {
      await persistProject(nextProject);
    } catch {}
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setExportState({
      progress: 0,
      stage: null,
      isExporting: false,
      downloadUrl: null
    });
    setMessage("Uploading audio locally...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/audio/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as UploadResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Upload failed.");
      }

      const title = stripFileExtension(file.name) || "Untitled Session";
      const nextProject = replaceAudio(project, payload.audio, title);

      setProject(nextProject);
      setActiveStep(nextProject.workflowStep);
      setSelectedLineId(nextProject.lines[0]?.id ?? null);
      setTrimRange({
        startMs: 0,
        endMs: Math.min(payload.audio.durationMs, MAX_AUDIO_MS)
      });
      setMessage(
        payload.requiresTrim
          ? "Project created. Trim the audio before transcription begins."
          : "Project created. Starting transcription..."
      );

      await persistProject(nextProject);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed unexpectedly.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleTrim() {
    if (!project.audio) {
      return;
    }

    setIsTrimming(true);
    setMessage("Trimming audio with FFmpeg...");

    try {
      const response = await fetch("/api/audio/trim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          audioId: project.audio.id,
          startMs: trimRange.startMs,
          endMs: trimRange.endMs
        })
      });
      const payload = (await response.json()) as {
        audio?: LyricProject["audio"];
        message?: string;
      };

      if (!response.ok || !payload.audio) {
        throw new Error(payload.message ?? "Trim failed.");
      }

      const nextProject = replaceAudio(project, payload.audio, project.title);

      setProject(nextProject);
      setActiveStep("transcribe");
      setTrimRange({
        startMs: 0,
        endMs: payload.audio.durationMs
      });
      setMessage("Trim complete. Starting transcription...");

      await persistProject(nextProject);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trim failed unexpectedly.");
    } finally {
      setIsTrimming(false);
    }
  }

  async function handleBackgroundAssetUpload(file: File) {
    setIsUploadingBackground(true);
    setMessage(`Uploading ${file.type.startsWith("video/") ? "video" : "photo"} background...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/background/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as
        | (BackgroundUploadResponse & {message?: string})
        | {message?: string};

      if (!response.ok || !("asset" in payload)) {
        throw new Error(payload.message ?? "Background upload failed.");
      }

      updateProject((currentProject) => ({
        ...currentProject,
        background: {
          ...currentProject.background,
          mode: payload.asset.mediaType,
          mediaAsset: payload.asset
        }
      }));
      setMessage(
        `${payload.asset.mediaType === "video" ? "Video" : "Photo"} background ready.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Background upload failed unexpectedly."
      );
    } finally {
      setIsUploadingBackground(false);
    }
  }

  function handleLineChange(lineId: string, patch: Partial<LyricLine>) {
    updateProject((currentProject) => {
      const totalDuration = currentProject.audio?.durationMs ?? MAX_AUDIO_MS;
      const updatedLines = currentProject.lines.map((line) =>
        line.id === lineId ? {...line, ...patch} : line
      );

      return {
        ...currentProject,
        lines: normalizeLines(updatedLines, totalDuration)
      };
    });
  }

  function handleSplit(lineId: string) {
    updateProject((currentProject) => {
      const targetLine = currentProject.lines.find((line) => line.id === lineId);

      if (!targetLine) {
        return currentProject;
      }

      const splitLines = splitLine(targetLine);
      const nextLines = currentProject.lines.flatMap((line) =>
        line.id === lineId ? splitLines : [line]
      );

      setSelectedLineId(splitLines[0]?.id ?? null);

      return {
        ...currentProject,
        lines: normalizeLines(
          nextLines,
          currentProject.audio?.durationMs ?? MAX_AUDIO_MS
        )
      };
    });
  }

  function handleMergeDown(lineId: string) {
    updateProject((currentProject) => {
      const lineIndex = currentProject.lines.findIndex((line) => line.id === lineId);

      if (lineIndex < 0 || lineIndex === currentProject.lines.length - 1) {
        return currentProject;
      }

      const merged = mergeLines(
        currentProject.lines[lineIndex],
        currentProject.lines[lineIndex + 1]
      );
      const nextLines = currentProject.lines.filter(
        (_, index) => index !== lineIndex && index !== lineIndex + 1
      );

      nextLines.splice(lineIndex, 0, merged);
      setSelectedLineId(merged.id);

      return {
        ...currentProject,
        lines: normalizeLines(
          nextLines,
          currentProject.audio?.durationMs ?? MAX_AUDIO_MS
        )
      };
    });
  }

  function handleAddAfter(lineId: string) {
    updateProject((currentProject) => {
      const lineIndex = currentProject.lines.findIndex((line) => line.id === lineId);
      const currentLine = currentProject.lines[lineIndex];

      if (!currentLine) {
        return currentProject;
      }

      const startMs = currentLine.endMs;
      const endMs = Math.min(
        currentProject.audio?.durationMs ?? MAX_AUDIO_MS,
        startMs + 1_200
      );
      const insertedLine: LyricLine = {
        id: crypto.randomUUID(),
        text: "New line",
        startMs,
        endMs: Math.max(startMs + MIN_LINE_MS, endMs)
      };
      const nextLines = [...currentProject.lines];

      nextLines.splice(lineIndex + 1, 0, insertedLine);
      setSelectedLineId(insertedLine.id);

      return {
        ...currentProject,
        lines: normalizeLines(
          nextLines,
          currentProject.audio?.durationMs ?? MAX_AUDIO_MS
        )
      };
    });
  }

  const handleLoadProject = useCallback(async (projectId: string) => {
    setIsLoadingProject(true);
    setMessage("Loading saved project...");

    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const payload = (await response.json()) as {
        project?: LyricProject;
        message?: string;
      };

      if (!response.ok || !payload.project) {
        throw new Error(payload.message ?? "Project load failed.");
      }

      const hydrated = hydrateProject(payload.project);
      const resumableProject =
        hydrated.workflowStep === "transcribe" &&
        hydrated.transcriptionStatus === "running"
          ? {
              ...hydrated,
              transcriptionStatus: "idle" as const
            }
          : hydrated;

      lastSavedSnapshotRef.current = serializeProject(resumableProject);
      setProject(resumableProject);
      setActiveStep(resumableProject.workflowStep);
      setSelectedLineId(resumableProject.lines[0]?.id ?? null);
      setTrimRange({
        startMs: 0,
        endMs: Math.min(
          resumableProject.audio?.durationMs ?? MAX_AUDIO_MS,
          MAX_AUDIO_MS
        )
      });
      setExportState({
        progress: 0,
        stage: null,
        isExporting: false,
        downloadUrl: null
      });
      setSaveState(resumableProject.audio ? "saved" : "idle");
      setHasPendingChanges(false);
      setMessage("Project loaded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Project load failed unexpectedly."
      );
    } finally {
      setIsLoadingProject(false);
    }
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const shouldDelete = window.confirm(
      "Delete this project? This cannot be undone."
    );

    if (!shouldDelete) {
      return;
    }

    setIsLoadingProject(true);
    setMessage("Deleting project...");

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | {message?: string}
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Project delete failed.");
      }

      setSavedProjects((currentProjects) =>
        currentProjects.filter((projectItem) => projectItem.id !== projectId)
      );

      if (project.id === projectId) {
        const nextProject = createFreshProject(initialReleaseId);

        lastSavedSnapshotRef.current = null;
        setProject(nextProject);
        setActiveStep("audio");
        setSelectedLineId(nextProject.lines[0]?.id ?? null);
        setTrimRange({
          startMs: 0,
          endMs: MAX_AUDIO_MS
        });
        setExportState({
          progress: 0,
          stage: null,
          isExporting: false,
          downloadUrl: null
        });
        setSaveState("idle");
        setHasPendingChanges(false);
        setMessage("Loaded project deleted. Started a fresh project.");

        return;
      }

      setMessage("Project deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Project delete failed unexpectedly."
      );
    } finally {
      setIsLoadingProject(false);
    }
  }, [initialReleaseId, project.id]);

  useEffect(() => {
    const requestedProjectId = initialProjectId ?? null;

    if (!requestedProjectId || initialProjectLoadRef.current === requestedProjectId) {
      return;
    }

    initialProjectLoadRef.current = requestedProjectId;
    void handleLoadProject(requestedProjectId);
  }, [handleLoadProject, initialProjectId]);

  function exportSrt() {
    const srt = linesToSrt(project.lines);
    const blob = new Blob([srt], {type: "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${project.title || "videolab"}.srt`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("SRT exported.");
  }

  async function handleManualSave() {
    if (!canPersistProject) {
      setMessage("Upload audio first to create a project before saving.");
      return;
    }

    if (!hasPendingChanges) {
      setMessage("No unsaved changes to save.");
      return;
    }

    try {
      await persistProject(project, {successMessage: "Project saved."});
    } catch {}
  }

  async function exportVideo() {
    if (!project.audio) {
      setMessage("Upload and transcribe audio before exporting.");
      return;
    }

    setExportState({
      progress: 0.04,
      stage: "Starting export...",
      isExporting: true,
      downloadUrl: null
    });
    setMessage("Rendering MP4 locally with Remotion...");

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project,
          resolution: project.resolution
        })
      });

      if (!response.ok || !response.body) {
        const errorBody = (await response.json().catch(() => null)) as
          | {message?: string}
          | null;

        throw new Error(errorBody?.message ?? "Export failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const {done, value} = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {stream: true});
        const chunks = buffer.split("\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.trim()) {
            continue;
          }

          const event = JSON.parse(chunk) as ExportStreamEvent;

          if (event.type === "progress") {
            setExportState((current) => ({
              ...current,
              progress: Math.max(current.progress, event.progress),
              stage: event.stage ?? current.stage
            }));
          }

          if (event.type === "complete") {
            setExportState({
              progress: 1,
              stage: "Render complete",
              isExporting: false,
              downloadUrl: event.downloadUrl
            });
            setMessage("Video export finished.");
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (error) {
      setExportState({
        progress: 0,
        stage: "Export failed",
        isExporting: false,
        downloadUrl: null
      });
      setMessage(error instanceof Error ? error.message : "Export failed unexpectedly.");
    }
  }

  function unlockStep(step: WorkflowStep) {
    updateProject((currentProject) => ({
      ...currentProject,
      workflowStep: step
    }));
    setActiveStep(step);
  }

  function renderStepContent() {
    if (activeStep === "context") {
      return (
        <ReleaseContextStep
          onContinue={handleContextContinue}
          onSelectRelease={(release_id) =>
            updateProject((currentProject) => ({
              ...currentProject,
              release_id
            }))
          }
          releases={availableReleases}
          selectedReleaseId={project.release_id}
        />
      );
    }

    if (activeStep === "audio") {
      return (
        <AudioDropzone
          audio={project.audio}
          isTranscribing={isTranscribing}
          isUploading={isUploading}
          message={message}
          onFileSelect={handleUpload}
          requiresTrim={requiresTrim}
        />
      );
    }

    if (activeStep === "trim") {
      return (
        <TrimEditor
          audio={project.audio}
          endMs={trimRange.endMs}
          isTrimming={isTrimming}
          onRangeChange={setTrimRange}
          onTrim={handleTrim}
          requiresTrim={requiresTrim}
          startMs={trimRange.startMs}
        />
      );
    }

    if (activeStep === "transcribe") {
      return (
        <TranscriptionStep
          language={project.transcriptionLanguage}
          isTranscribing={isTranscribing}
          message={message}
          onContinue={() => unlockStep("edit")}
          onLanguageChange={(transcriptionLanguage) =>
            updateProject((currentProject) => ({
              ...currentProject,
              transcriptionLanguage,
              transcriptionStatus: currentProject.audio ? "idle" : currentProject.transcriptionStatus
            }))
          }
          onRetry={() => {
            if (project.audio) {
              return runTranscription(project.audio.id, project.transcriptionLanguage);
            }
          }}
          status={project.transcriptionStatus}
        />
      );
    }

    if (activeStep === "edit") {
      return (
          <div className="space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_500px]">
            <LyricsEditor
              lines={project.lines}
              onAddAfter={handleAddAfter}
              onLineChange={handleLineChange}
              onMergeDown={handleMergeDown}
              onSelect={setSelectedLineId}
              onSplit={handleSplit}
              selectedLineId={selectedLineId}
              totalDurationMs={project.audio?.durationMs ?? MAX_AUDIO_MS}
            />
            <LivePreview project={deferredProject} />
          </div>

          <div className="flex justify-end">
            <button
              className="action-button-primary"
              onClick={() => unlockStep("style")}
              type="button"
            >
              Continue to Style
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (activeStep === "style") {
      return (
        <div className="space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[500px_minmax(0,1fr)]">
            <LivePreview
              onPlacementChange={(lyricPlacement) =>
                updateProject((currentProject) => ({
                  ...currentProject,
                  lyricPlacement
                }))
              }
              project={deferredProject}
            />
            <StylePanel
              animationStyle={project.animationStyle}
              aspectRatio={project.aspectRatio}
              background={project.background}
              isUploadingBackground={isUploadingBackground}
              lyrics={project.lyrics}
              onAnimationChange={(animationStyle) =>
                updateProject((currentProject) => ({
                  ...currentProject,
                  animationStyle
                }))
              }
              onBackgroundAssetClear={() =>
                updateProject((currentProject) => ({
                  ...currentProject,
                  background: {
                    ...currentProject.background,
                    mode:
                      currentProject.background.mode === "image" ||
                      currentProject.background.mode === "video"
                        ? "gradient"
                        : currentProject.background.mode,
                    mediaAsset: null
                  }
                }))
              }
              onBackgroundAssetSelect={handleBackgroundAssetUpload}
              onAspectRatioChange={(aspectRatio) =>
                updateProject((currentProject) => ({
                  ...currentProject,
                  aspectRatio
                }))
              }
              onBackgroundChange={(patch) =>
                updateProject((currentProject) => ({
                  ...currentProject,
                  background: {
                    ...currentProject.background,
                    ...patch
                  }
                }))
              }
              onLyricsChange={(patch) =>
                updateProject((currentProject) => ({
                  ...currentProject,
                  lyrics: {
                    ...currentProject.lyrics,
                    ...patch
                  }
                }))
              }
              onPresetSelect={(presetId) =>
                updateProject((currentProject) =>
                  applyStylePreset(currentProject, presetId)
                )
              }
            />
          </div>

          <div className="flex justify-end">
            <button
              className="action-button-primary"
              onClick={() => unlockStep("export")}
              type="button"
            >
              Continue to Export
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-6 2xl:grid-cols-[500px_minmax(0,1fr)]">
        <LivePreview
          onPlacementChange={(lyricPlacement) =>
            updateProject((currentProject) => ({
              ...currentProject,
              lyricPlacement
            }))
          }
          project={deferredProject}
        />
        <ExportPanel
          downloadUrl={exportState.downloadUrl}
          exportProgress={exportState.progress}
          exportStage={exportState.stage}
          isExporting={exportState.isExporting}
          onExportSrt={exportSrt}
          onExportVideo={exportVideo}
          onResolutionChange={(resolution) =>
            updateProject((currentProject) => ({
              ...currentProject,
              resolution
            }))
          }
          resolution={project.resolution}
        />
      </div>
    );
  }

  const currentCopy = stepCopy[activeStep];
  const previousStep = getPreviousStep(activeStep, requiresTrim);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="pill">Local-first video creation studio</div>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                {currentCopy.eyebrow}
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
                {currentCopy.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                {currentCopy.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="pill">
                  <Film size={12} />
                  Sequential workflow
                </span>
                <span className="pill">
                  {project.release_id ? "Linked to release" : "Standalone supported"}
                </span>
                <span className="pill">Autosaves every minute</span>
                <span className="pill">Local Whisper + FFmpeg</span>
              </div>
            </div>

            <div className="rounded-[28px] bg-hero-mesh p-4 sm:p-6 shadow-soft">
              <div className="rounded-[24px] border border-white/60 bg-white/75 p-4 sm:p-5 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                  <Wand2 size={16} />
                  Session status
                </div>
                <p className="mt-3 text-2xl font-semibold text-ink">{project.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {message ??
                    "Upload a clip to begin. Video Lab now walks through one step at a time and saves progress automatically."}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[20px] bg-white/80 p-4">
                    <p className="field-label">Release</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {project.release_id ? "Attached" : "Standalone"}
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/80 p-4">
                    <p className="field-label">Audio</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {project.audio ? "Loaded" : "Waiting"}
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/80 p-4">
                    <p className="field-label">Step</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {project.workflowStep}
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/80 p-4">
                    <p className="field-label">Save status</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {saveStatusLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <WorkflowStepper
          currentStep={activeStep}
          maxUnlockedStep={project.workflowStep}
          onStepSelect={(step) => {
            const requestedStepIndex = workflowOrder.indexOf(step);
            const unlockedIndex = workflowOrder.indexOf(project.workflowStep);

            if (requestedStepIndex <= unlockedIndex) {
              setActiveStep(step);
            }
          }}
        />

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <ProjectLibrary
            currentProjectId={project.id}
            currentStep={activeStep}
            isBusy={isLoadingProject}
            onDelete={handleDeleteProject}
            onLoad={handleLoadProject}
            onNewProject={handleNewProject}
            onTitleChange={(title) =>
              updateProject((currentProject) => ({
                ...currentProject,
                title
              }))
            }
            projects={savedProjects}
            saveState={saveState}
            hasPendingChanges={hasPendingChanges}
            canManualSave={canPersistProject && hasPendingChanges && saveState !== "saving"}
            title={project.title}
            onManualSave={handleManualSave}
          />

          <div className="space-y-6">
            {renderStepContent()}

            {previousStep ? (
              <div className="flex justify-start">
                <button
                  className="action-button-secondary"
                  onClick={() => setActiveStep(previousStep)}
                  type="button"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
