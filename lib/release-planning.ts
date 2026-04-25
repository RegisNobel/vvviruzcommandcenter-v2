import {
  calculateReleaseProgress,
  hasReleaseCoverArt,
  type ReleaseChecklistKey
} from "@/lib/releases";
import type {ReleasePlanStep, ReleaseRecord, ReleaseStageLabel} from "@/lib/types";

type ReleasePlanningStageDefinition = {
  id: ReleaseChecklistKey | "cover_art";
  checkboxKey?: ReleaseChecklistKey;
  label: Exclude<ReleaseStageLabel, "Not Started">;
  isComplete: (release: ReleaseRecord) => boolean;
  getRequirements: (
    release: ReleaseRecord
  ) => Array<{blocker: string; nextAction: string}>;
};

export const releasePlanningStages: ReleasePlanningStageDefinition[] = [
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

export function getCurrentReleasePlanningStage(release: ReleaseRecord) {
  return (
    releasePlanningStages.find((stage) => !stage.isComplete(release)) ??
    releasePlanningStages[releasePlanningStages.length - 1]
  );
}

export function getReleasePlanningValidationWarnings(release: ReleaseRecord) {
  return releasePlanningStages.flatMap((stage) => {
    if (!stage.checkboxKey || !stage.isComplete(release)) {
      return [];
    }

    return stage.getRequirements(release).map(
      (requirement) => `${stage.label} validation warning: ${requirement.blocker}`
    );
  });
}

export function getReleasePlanningNextAction(release: ReleaseRecord) {
  const currentStage = getCurrentReleasePlanningStage(release);
  const requirements = currentStage.getRequirements(release);

  if (requirements.length > 0) {
    return requirements[0].nextAction;
  }

  if (currentStage.checkboxKey && !currentStage.isComplete(release)) {
    return `Mark ${currentStage.label} complete`;
  }

  return "No action needed";
}

export function getReleasePlanningBlockers(release: ReleaseRecord) {
  const currentStage = getCurrentReleasePlanningStage(release);
  const currentStageRequirements = currentStage.getRequirements(release);
  const blockers = [...getReleasePlanningValidationWarnings(release)];

  if (currentStageRequirements.length > 0) {
    blockers.push(...currentStageRequirements.map((requirement) => requirement.blocker));
    return blockers;
  }

  if (currentStage.checkboxKey && !currentStage.isComplete(release)) {
    blockers.push(`${currentStage.label} approval pending`);
  }

  return blockers;
}

export function getReleasePlanningSteps(release: ReleaseRecord): ReleasePlanStep[] {
  const currentStage = getCurrentReleasePlanningStage(release);

  return releasePlanningStages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    complete: stage.isComplete(release),
    current: stage.id === currentStage.id
  }));
}

export function getReleasePlanningSnapshot(release: ReleaseRecord) {
  const currentStage = getCurrentReleasePlanningStage(release);
  const blockers = getReleasePlanningBlockers(release);
  const validationWarnings = getReleasePlanningValidationWarnings(release);

  return {
    current_stage: currentStage.label,
    next_action: getReleasePlanningNextAction(release),
    blockers,
    validation_warnings: validationWarnings,
    stage_steps: getReleasePlanningSteps(release),
    progress_percentage: calculateReleaseProgress(release)
  };
}
