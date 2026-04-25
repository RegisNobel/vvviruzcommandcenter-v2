import "server-only";

import path from "node:path";

import {FRAME_RATE} from "@/lib/constants";
import {exportsDir} from "@/lib/server/storage";
import type {ExportStreamEvent, LyricProject, ResolutionPreset} from "@/lib/types";
import {getProjectDurationFrames} from "@/lib/video/project";
import {absoluteUrl, createId} from "@/lib/utils";

const compositionId = "VideoLabComposition";
const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
let bundlePromise: Promise<string> | null = null;

async function getServeUrl() {
  const {bundle} = await import("@remotion/bundler");

  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...config.resolve?.alias,
            "@": path.resolve(process.cwd())
          }
        }
      })
    });
  }

  return bundlePromise;
}

function getScaleForResolution(resolution: ResolutionPreset) {
  return resolution === "720p" ? 2 / 3 : 1;
}

export async function renderProjectVideo({
  project,
  resolution,
  origin,
  onEvent
}: {
  project: LyricProject;
  resolution: ResolutionPreset;
  origin: string;
  onEvent: (event: ExportStreamEvent) => void;
}) {
  const {renderMedia, selectComposition} = await import("@remotion/renderer");
  const serveUrl = await getServeUrl();
  const outputFileName = `videolab-${project.id}-${resolution}-${createId()}.mp4`;
  const outputLocation = path.join(exportsDir, outputFileName);
  const renderProject =
    project.background.mediaAsset
      ? {
          ...project,
          background: {
            ...project.background,
            mediaAsset: {
              ...project.background.mediaAsset,
              url: absoluteUrl(origin, project.background.mediaAsset.url)
            }
          }
        }
      : project;
  const inputProps = {
    project: renderProject,
    audioSrc: project.audio ? absoluteUrl(origin, project.audio.url) : null
  };
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
    logLevel: "error"
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    outputLocation,
    inputProps,
    frameRange: [0, getProjectDurationFrames(project, FRAME_RATE) - 1],
    scale: getScaleForResolution(resolution),
    x264Preset: "medium",
    audioBitrate: "192k",
    crf: 18,
    logLevel: "error",
    onProgress: ({progress, renderedFrames, encodedFrames, stitchStage}) => {
      onEvent({
        type: "progress",
        progress,
        renderedFrames,
        encodedFrames,
        stage: stitchStage
      });
    }
  });

  return {
    fileName: outputFileName,
    downloadUrl: `/api/assets/export/${outputFileName}`
  };
}
