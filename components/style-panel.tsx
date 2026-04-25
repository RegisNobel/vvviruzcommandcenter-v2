"use client";

import {ImagePlus, Sparkles, Trash2, Type, Video} from "lucide-react";

import {FONT_OPTIONS, STYLE_PRESETS} from "@/lib/constants";
import type {
  AnimationStyle,
  BackgroundMediaAsset,
  BackgroundStyle,
  LyricStyle,
  PreviewAspectRatio
} from "@/lib/types";

type StylePanelProps = {
  background: BackgroundStyle;
  lyrics: LyricStyle;
  animationStyle: AnimationStyle;
  aspectRatio: PreviewAspectRatio;
  onPresetSelect: (presetId: string) => void;
  onBackgroundChange: (patch: Partial<BackgroundStyle>) => void;
  onBackgroundAssetSelect: (file: File) => void | Promise<void>;
  onBackgroundAssetClear: () => void;
  onLyricsChange: (patch: Partial<LyricStyle>) => void;
  onAnimationChange: (animationStyle: AnimationStyle) => void;
  onAspectRatioChange: (aspectRatio: PreviewAspectRatio) => void;
  isUploadingBackground: boolean;
};

export function StylePanel({
  background,
  lyrics,
  animationStyle,
  aspectRatio,
  onPresetSelect,
  onBackgroundChange,
  onBackgroundAssetSelect,
  onBackgroundAssetClear,
  onLyricsChange,
  onAnimationChange,
  onAspectRatioChange,
  isUploadingBackground
}: StylePanelProps) {
  const backgroundAsset = background.mediaAsset ?? null;
  const selectedMediaType = background.mode === "video" ? "video" : "image";
  const acceptedFiles = selectedMediaType === "video" ? "video/*" : "image/*";
  const modeLabel =
    background.mode === "video"
      ? "Video"
      : background.mode === "image"
        ? "Photo"
        : "Background";

  function renderBackgroundAsset(asset: BackgroundMediaAsset | null) {
    if (!asset) {
      return (
        <p className="text-sm leading-6 text-slate-500">
          Upload a {selectedMediaType === "video" ? "video" : "photo"} from your PC
          to use it as the background.
        </p>
      );
    }

    return (
      <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-4">
        <p className="text-sm font-semibold text-slate-900">{asset.fileName}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
          {asset.mediaType} background
        </p>
      </div>
    );
  }

  return (
    <section className="panel p-6">
      <div className="panel-header">
        <div>
          <p className="field-label">Style & Motion</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            Shape the video look
          </h2>
        </div>
        <span className="pill">Live preview</span>
      </div>

      <div className="mt-5 space-y-6">
        <div className="rounded-[24px] border border-slate-200/70 bg-white/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="field-label">Preview Canvas</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                Pick the video shape first
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Switch between vertical and horizontal, then drag the lyric
                frame in the preview to place it.
              </p>
            </div>
            <span className="pill">{aspectRatio}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                value: "9:16" as const,
                title: "Vertical",
                copy: "Best for Reels, Shorts, and Stories."
              },
              {
                value: "16:9" as const,
                title: "Horizontal",
                copy: "Best for YouTube and widescreen playback."
              }
            ].map((option) => {
              const isActive = aspectRatio === option.value;

              return (
                <button
                  className={`rounded-[22px] border px-4 py-4 text-left transition ${
                    isActive
                      ? "border-coral/60 bg-coral/10 shadow-[0_14px_30px_rgba(255,122,89,0.14)]"
                      : "border-slate-200/70 bg-white/80 hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white"
                  }`}
                  key={option.value}
                  onClick={() => onAspectRatioChange(option.value)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {option.title}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {option.value}
                      </p>
                    </div>
                    <div
                      className="rounded-[18px] border border-slate-200/70 bg-slate-100"
                      style={{
                        width: option.value === "9:16" ? "34px" : "56px",
                        height: option.value === "9:16" ? "56px" : "34px"
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{option.copy}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles size={16} />
            Presets
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {STYLE_PRESETS.map((preset) => (
              <button
                className="rounded-[22px] border border-slate-200/70 bg-white/70 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white"
                key={preset.id}
                onClick={() => onPresetSelect(preset.id)}
                type="button"
              >
                <div
                  className="h-10 rounded-2xl"
                  style={{
                    background:
                      preset.background.mode === "solid"
                        ? preset.background.solidColor
                        : `linear-gradient(135deg, ${preset.background.gradientFrom}, ${preset.background.gradientTo})`
                  }}
                />
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {preset.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {preset.animationStyle}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-[24px] border border-slate-200/70 bg-white/70 p-5">
            <p className="field-label">Background</p>

            <label className="space-y-2">
              <span className="field-label">Mode</span>
              <select
                className="field-input"
                onChange={(event) =>
                  onBackgroundChange({
                    mode: event.target.value as BackgroundStyle["mode"]
                  })
                }
                value={background.mode}
              >
                <option value="solid">Solid</option>
                <option value="gradient">Gradient</option>
                <option value="motion">Motion Loop</option>
                <option value="image">Photo</option>
                <option value="video">Video</option>
              </select>
            </label>

            {background.mode === "image" || background.mode === "video" ? (
              <div className="space-y-3 rounded-[22px] border border-slate-200/70 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {background.mode === "video" ? (
                    <Video size={16} />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  {modeLabel} Background
                </div>

                {renderBackgroundAsset(
                  backgroundAsset?.mediaType === selectedMediaType
                    ? backgroundAsset
                    : null
                )}

                <div className="flex flex-wrap gap-3">
                  <label className="action-button-secondary">
                    {isUploadingBackground
                      ? `Uploading ${selectedMediaType}...`
                      : `Choose ${selectedMediaType === "video" ? "Video" : "Photo"}`}
                    <input
                      accept={acceptedFiles}
                      className="hidden"
                      disabled={isUploadingBackground}
                      onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                          void onBackgroundAssetSelect(file);
                        }

                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>

                  {backgroundAsset ? (
                    <button
                      className="action-button-secondary"
                      onClick={onBackgroundAssetClear}
                      type="button"
                    >
                      <Trash2 size={16} />
                      Remove Media
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Primary</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onBackgroundChange({solidColor: event.target.value})
                  }
                  type="color"
                  value={background.solidColor}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Accent</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onBackgroundChange({accentColor: event.target.value})
                  }
                  type="color"
                  value={background.accentColor}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Gradient From</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onBackgroundChange({gradientFrom: event.target.value})
                  }
                  type="color"
                  value={background.gradientFrom}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Gradient To</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onBackgroundChange({gradientTo: event.target.value})
                  }
                  type="color"
                  value={background.gradientTo}
                />
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-slate-200/70 bg-white/70 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Type size={16} />
              Lyrics
            </div>

            <label className="space-y-2">
              <span className="field-label">Animation</span>
              <select
                className="field-input"
                onChange={(event) =>
                  onAnimationChange(event.target.value as AnimationStyle)
                }
                value={animationStyle}
              >
                <option value="fade">Fade</option>
                <option value="slide-up">Slide Up</option>
                <option value="pop">Pop</option>
                <option value="typewriter">Typewriter</option>
                <option value="karaoke">Karaoke Highlight</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">Font</span>
              <select
                className="field-input"
                onChange={(event) =>
                  onLyricsChange({fontFamily: event.target.value})
                }
                value={lyrics.fontFamily}
              >
                {FONT_OPTIONS.map((fontOption) => (
                  <option key={fontOption.label} value={fontOption.value}>
                    {fontOption.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Text Color</span>
                <input
                  className="field-input h-12"
                  onChange={(event) => onLyricsChange({color: event.target.value})}
                  type="color"
                  value={lyrics.color}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Karaoke Color</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onLyricsChange({karaokeColor: event.target.value})
                  }
                  type="color"
                  value={lyrics.karaokeColor}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Stroke Color</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onLyricsChange({strokeColor: event.target.value})
                  }
                  type="color"
                  value={lyrics.strokeColor}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Shadow Color</span>
                <input
                  className="field-input h-12"
                  onChange={(event) =>
                    onLyricsChange({shadowColor: event.target.value})
                  }
                  type="color"
                  value={lyrics.shadowColor}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Alignment</span>
                <select
                  className="field-input"
                  onChange={(event) =>
                    onLyricsChange({
                      alignment: event.target.value as LyricStyle["alignment"]
                    })
                  }
                  value={lyrics.alignment}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="field-label">Font Size</span>
                <input
                  className="field-input"
                  max={120}
                  min={36}
                  onChange={(event) =>
                    onLyricsChange({fontSize: Number(event.target.value)})
                  }
                  type="range"
                  value={lyrics.fontSize}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="field-label">Stroke</span>
                <input
                  className="field-input"
                  max={8}
                  min={0}
                  onChange={(event) =>
                    onLyricsChange({strokeWidth: Number(event.target.value)})
                  }
                  type="range"
                  value={lyrics.strokeWidth}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Shadow</span>
                <input
                  className="field-input"
                  max={36}
                  min={0}
                  onChange={(event) =>
                    onLyricsChange({shadowBlur: Number(event.target.value)})
                  }
                  type="range"
                  value={lyrics.shadowBlur}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Line Height</span>
                <input
                  className="field-input"
                  max={1.5}
                  min={0.9}
                  onChange={(event) =>
                    onLyricsChange({lineHeight: Number(event.target.value)})
                  }
                  step={0.02}
                  type="range"
                  value={lyrics.lineHeight}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
