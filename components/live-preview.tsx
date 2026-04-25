"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {MonitorPlay, Move} from "lucide-react";
import {Player} from "@remotion/player";

import {FRAME_RATE} from "@/lib/constants";
import type {LyricPlacement, LyricProject} from "@/lib/types";
import {clamp} from "@/lib/utils";
import {
  getAspectRatioDimensions,
  resolveLyricBoxPlacement
} from "@/lib/video/layout";
import {getProjectDurationFrames} from "@/lib/video/project";
import {LyricVideoTemplate} from "@/remotion/templates/lyric-video";

type LivePreviewProps = {
  project: LyricProject;
  onPlacementChange?: (placement: LyricPlacement) => void;
};

export function LivePreview({project, onPlacementChange}: LivePreviewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draftPlacement, setDraftPlacement] = useState(project.lyricPlacement);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<{x: number; y: number} | null>(null);
  const previewProject = isDragging
    ? {
        ...project,
        lyricPlacement: draftPlacement
      }
    : project;
  const dimensions = getAspectRatioDimensions(previewProject.aspectRatio);
  const previewLayout = resolveLyricBoxPlacement({
    aspectRatio: previewProject.aspectRatio,
    placement: previewProject.lyricPlacement,
    width: dimensions.width,
    height: dimensions.height
  });
  const boxLeftPercent = (previewLayout.left / dimensions.width) * 100;
  const boxTopPercent = (previewLayout.top / dimensions.height) * 100;
  const boxWidthPercent = (previewLayout.boxWidth / dimensions.width) * 100;
  const boxHeightPercent = (previewLayout.boxHeight / dimensions.height) * 100;
  const handleTopPercent =
    ((previewLayout.top + Math.max(18, dimensions.height * 0.016)) / dimensions.height) *
    100;
  const handleLeftPercent =
    ((previewLayout.left + previewLayout.boxWidth / 2) / dimensions.width) * 100;

  useEffect(() => {
    if (!isDragging) {
      setDraftPlacement(project.lyricPlacement);
    }
  }, [isDragging, project.lyricPlacement]);

  const updatePlacementFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!previewFrameRef.current) {
        return;
      }

      const rect = previewFrameRef.current.getBoundingClientRect();
      const liveLayout = resolveLyricBoxPlacement({
        aspectRatio: project.aspectRatio,
        placement: project.lyricPlacement,
        width: rect.width,
        height: rect.height
      });
      const dragOffset = dragOffsetRef.current ?? {
        x: liveLayout.boxWidth / 2,
        y: Math.min(36, liveLayout.boxHeight / 4)
      };
      const nextLeft = clamp(
        clientX - rect.left - dragOffset.x - liveLayout.framePaddingX,
        0,
        liveLayout.maxOffsetX
      );
      const nextTop = clamp(
        clientY - rect.top - dragOffset.y - liveLayout.framePaddingY,
        0,
        liveLayout.maxOffsetY
      );

      setDraftPlacement({
        x: liveLayout.maxOffsetX === 0 ? 0 : nextLeft / liveLayout.maxOffsetX,
        y: liveLayout.maxOffsetY === 0 ? 0 : nextTop / liveLayout.maxOffsetY
      });
    },
    [project.aspectRatio, project.lyricPlacement]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!onPlacementChange || !previewFrameRef.current) {
        return;
      }

      const rect = previewFrameRef.current.getBoundingClientRect();
      const liveLayout = resolveLyricBoxPlacement({
        aspectRatio: project.aspectRatio,
        placement: project.lyricPlacement,
        width: rect.width,
        height: rect.height
      });

      dragOffsetRef.current = {
        x: event.clientX - rect.left - liveLayout.left,
        y: event.clientY - rect.top - liveLayout.top
      };
      setDraftPlacement(project.lyricPlacement);
      setIsDragging(true);
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      updatePlacementFromPoint(event.clientX, event.clientY);
    },
    [onPlacementChange, project.aspectRatio, project.lyricPlacement, updatePlacementFromPoint]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isDragging) {
        return;
      }

      event.preventDefault();
      updatePlacementFromPoint(event.clientX, event.clientY);
    },
    [isDragging, updatePlacementFromPoint]
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (onPlacementChange) {
        onPlacementChange(draftPlacement);
      }

      dragOffsetRef.current = null;
      setIsDragging(false);
    },
    [draftPlacement, onPlacementChange]
  );

  return (
    <section className="panel p-4 sm:p-6">
      <div className="panel-header">
        <div>
          <p className="field-label">Live Preview</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            {onPlacementChange
              ? "Drag the lyric block and watch it update"
              : "Player updates as you edit"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="pill">
            <MonitorPlay size={12} />
            {project.aspectRatio} canvas
          </span>
          {onPlacementChange ? (
            <span className="pill">
              <Move size={12} />
              Drag lyrics
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex justify-center rounded-[24px] border border-[#2f343b] bg-[#12151a] p-3 sm:rounded-[30px] sm:p-5">
        <div
          className="relative w-full max-w-[720px] overflow-hidden rounded-[20px] sm:rounded-[32px]"
          ref={previewFrameRef}
          style={{
            aspectRatio: `${dimensions.width} / ${dimensions.height}`
          }}
        >
          <Player
            acknowledgeRemotionLicense
            autoPlay={false}
            className="h-full w-full overflow-hidden rounded-[20px] sm:rounded-[32px]"
            component={LyricVideoTemplate}
            compositionHeight={dimensions.height}
            compositionWidth={dimensions.width}
            controls
            durationInFrames={getProjectDurationFrames(project, FRAME_RATE)}
            fps={FRAME_RATE}
            inputProps={{
              project: previewProject,
              audioSrc: previewProject.audio?.url ?? null
            }}
            loop
            style={{
              width: "100%",
              height: "100%"
            }}
          />

          {onPlacementChange ? (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="pointer-events-none absolute rounded-[28px] border border-dashed border-[#c9a347]/80 bg-[#c9a347]/10"
                style={{
                  left: `${boxLeftPercent}%`,
                  top: `${boxTopPercent}%`,
                  width: `${boxWidthPercent}%`,
                  height: `${boxHeightPercent}%`
                }}
              />

              <button
                className="pointer-events-auto absolute inline-flex items-center gap-2 rounded-full border border-[#5b4920] bg-[#17130d]/92 px-3 py-2 text-[10px] sm:px-4 sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#e5c571] backdrop-blur transition hover:bg-[#1e1810]"
                onPointerCancel={handlePointerEnd}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                style={{
                  left: `${handleLeftPercent}%`,
                  top: `${handleTopPercent}%`,
                  transform: "translate(-50%, 0)",
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none"
                }}
                type="button"
              >
                <Move size={14} />
                {isDragging ? "Moving" : "Drag lyrics"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
