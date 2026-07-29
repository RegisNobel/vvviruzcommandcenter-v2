"use client";

import {useRouter} from "next/navigation";
import {useState, useTransition} from "react";

import {setArtistReleaseHomepagePlacementAction} from "@/app/admin/(protected)/artists/actions";
import type {ArtistReleaseHomepagePlacement} from "@/lib/repositories/artist-profiles";

const placementOptions: Array<{
  value: ArtistReleaseHomepagePlacement;
  label: string;
}> = [
  {value: "START_HERE", label: "Featured / Start Here"},
  {value: "SUPPORTING", label: "Supporting homepage release"},
  {value: "NONE", label: "Not on homepage"}
];

export function ArtistReleasePlacementControl({
  artistProfileId,
  releaseId,
  initialPlacement
}: {
  artistProfileId: string;
  releaseId: string;
  initialPlacement: ArtistReleaseHomepagePlacement;
}) {
  const router = useRouter();
  const [placement, setPlacement] = useState(initialPlacement);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectPlacement = (nextPlacement: ArtistReleaseHomepagePlacement) => {
    if (nextPlacement === placement || isPending) return;
    setMessage("");
    startTransition(async () => {
      const result = await setArtistReleaseHomepagePlacementAction({
        artistProfileId,
        releaseId,
        placement: nextPlacement
      });
      if (!result.ok) {
        setMessage(result.message || "Unable to update homepage placement.");
        return;
      }
      const savedPlacement = result.data ?? nextPlacement;
      setPlacement(savedPlacement);
      setMessage(
        savedPlacement === "NONE"
          ? "Removed from the artist homepage."
          : "Homepage placement saved. This release now has editorial access."
      );
      router.refresh();
    });
  };

  return (
    <section className="command-surface space-y-4 p-5 sm:p-6">
      <div>
        <p className="field-label">Artist homepage placement</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">
          Featured placement automatically enables editorial
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Choose Start Here or a supporting placement, then add the release story,
          context, lyrics, links, and Breaking Barz details below.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {placementOptions.map((option) => (
          <button
            aria-pressed={placement === option.value}
            className={
              placement === option.value
                ? "action-button-primary"
                : "action-button-secondary"
            }
            disabled={isPending}
            key={option.value}
            onClick={() => selectPlacement(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {message ? (
        <p className="rounded-lg border border-edge bg-input px-4 py-3 text-sm text-secondary">
          {message}
        </p>
      ) : null}
    </section>
  );
}
