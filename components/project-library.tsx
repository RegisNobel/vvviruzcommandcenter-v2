"use client";

import {FolderOpen, Plus, Save, Trash2} from "lucide-react";

import type {ProjectSummary, WorkflowStep} from "@/lib/types";

type AutoSaveState = "idle" | "saving" | "saved" | "error";

type ProjectLibraryProps = {
  currentProjectId: string;
  title: string;
  projects: ProjectSummary[];
  isBusy: boolean;
  currentStep: WorkflowStep;
  saveState: AutoSaveState;
  hasPendingChanges: boolean;
  canManualSave: boolean;
  onTitleChange: (title: string) => void;
  onNewProject: () => void;
  onManualSave: () => void | Promise<void>;
  onLoad: (projectId: string) => void | Promise<void>;
  onDelete: (projectId: string) => void | Promise<void>;
};

const stepLabels: Record<WorkflowStep, string> = {
  context: "Release Context",
  audio: "Audio",
  trim: "Trim",
  transcribe: "Transcribe",
  edit: "Edit",
  style: "Style",
  export: "Export"
};

const saveStateLabels: Record<AutoSaveState, string> = {
  idle: "No pending changes",
  saving: "Saving...",
  saved: "Saved",
  error: "Save failed"
};

export function ProjectLibrary({
  currentProjectId,
  title,
  projects,
  isBusy,
  currentStep,
  saveState,
  hasPendingChanges,
  canManualSave,
  onTitleChange,
  onNewProject,
  onManualSave,
  onLoad,
  onDelete
}: ProjectLibraryProps) {
  const saveStatusLabel =
    saveState === "saving"
      ? saveStateLabels.saving
      : saveState === "error"
        ? saveStateLabels.error
        : hasPendingChanges
          ? "Unsaved changes"
          : saveStateLabels.saved;

  return (
    <section className="panel p-4 sm:p-6">
      <div className="panel-header">
        <div>
          <p className="field-label">Project Library</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            Resume where you left off
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill">{projects.length} saved</span>
          <button
            className="action-button-primary"
            disabled={isBusy}
            onClick={onNewProject}
            type="button"
          >
            <Plus size={16} />
            New
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="space-y-2">
          <span className="field-label">Project title</span>
          <input
            className="field-input"
            disabled={isBusy}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Give this session a title"
            value={title}
          />
        </label>

        <div className="rounded-[22px] border border-slate-200/70 bg-white/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="field-label">Current step</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {stepLabels[currentStep]}
              </p>
            </div>
            <span className="pill">{saveStatusLabel}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="field-label">Autosave</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Every minute
              </p>
            </div>

            <button
              className={canManualSave ? "action-button-primary" : "action-button-secondary"}
              disabled={isBusy || !canManualSave}
              onClick={() => void onManualSave()}
              type="button"
            >
              <Save size={16} />
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {projects.map((project, index) => {
          const isLoaded = project.id === currentProjectId;

          return (
          <article
            className={`rounded-[22px] border p-4 transition ${
              isLoaded
                ? "border-coral/60 bg-coral/10 shadow-[0_16px_40px_rgba(255,122,89,0.12)]"
                : "border-slate-200/70 bg-white/75"
            }`}
            key={project.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="pill">{index + 1}</span>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {project.title}
                  </p>
                  {isLoaded ? <span className="pill">Loaded</span> : null}
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {stepLabels[project.workflowStep]} / {project.lineCount} lines
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                <button
                  className={isLoaded ? "action-button-primary" : "action-button-secondary"}
                  disabled={isBusy}
                  onClick={() => void onLoad(project.id)}
                  type="button"
                >
                  <FolderOpen size={16} />
                  {isLoaded ? "Loaded" : "Load"}
                </button>
                <button
                  className="action-button-danger"
                  disabled={isBusy}
                  onClick={() => void onDelete(project.id)}
                  type="button"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </article>
          );
        })}

        {projects.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-300/70 bg-white/50 px-4 py-5 text-sm text-slate-500">
            Saved sessions appear here automatically once you upload audio.
          </div>
        ) : null}
      </div>
    </section>
  );
}
