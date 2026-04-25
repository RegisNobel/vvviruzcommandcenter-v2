"use client";

import type {WorkflowStep} from "@/lib/types";

type WorkflowStepperProps = {
  currentStep: WorkflowStep;
  maxUnlockedStep: WorkflowStep;
  onStepSelect: (step: WorkflowStep) => void;
};

const steps: Array<{step: WorkflowStep; label: string}> = [
  {step: "context", label: "Release Context"},
  {step: "audio", label: "Audio"},
  {step: "trim", label: "Trim"},
  {step: "transcribe", label: "Transcribe"},
  {step: "edit", label: "Edit"},
  {step: "style", label: "Style"},
  {step: "export", label: "Export"}
];

export function WorkflowStepper({
  currentStep,
  maxUnlockedStep,
  onStepSelect
}: WorkflowStepperProps) {
  const maxUnlockedIndex = steps.findIndex((item) => item.step === maxUnlockedStep);
  const currentIndex = steps.findIndex((item) => item.step === currentStep);

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        {steps.map((item, index) => {
          const isCurrent = item.step === currentStep;
          const isUnlocked = index <= maxUnlockedIndex;
          const isComplete = index < currentIndex;

          return (
            <button
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition ${
                isCurrent
                  ? "border-coral bg-coral/10 text-ink"
                  : isUnlocked
                    ? "border-slate-200/80 bg-white/80 text-slate-700 hover:border-coral/40"
                    : "cursor-not-allowed border-slate-200/60 bg-white/45 text-slate-400"
              }`}
              disabled={!isUnlocked}
              key={item.step}
              onClick={() => onStepSelect(item.step)}
              type="button"
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  isCurrent
                    ? "bg-coral text-[#13161a]"
                    : isComplete
                      ? "bg-[#24282f] text-[#ece6da]"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {index + 1}
              </span>
              <div>
                <p className="field-label">{isComplete ? "Completed" : "Step"}</p>
                <p className="mt-1 text-sm font-semibold">{item.label}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
