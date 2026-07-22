import type {CopySummary} from "@/lib/types";

export const campaignPlatformOptions = ["meta", "instagram", "tiktok", "youtube", "email"] as const;
export const campaignPhaseOptions = ["prelaunch", "launch", "sustain", "retest"] as const;
export const campaignVisualOptions = ["amv", "perf", "2screens", "cover", "static"] as const;

export type CampaignNamingInput = {
  releaseSlug: string;
  copy: Pick<CopySummary, "hook_type" | "song_section"> | null;
  visual: string;
  revision: string;
  platform: string;
  audience: string;
  phase: string;
};

export type CampaignNamingOutput = {
  adName: string;
  campaignLabel: string;
  contentLabel: string;
  utm: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content: string;
    utm_term: string;
  };
};

export function normalizeCampaignSegment(value: string, fallback = "general") {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return normalized || fallback;
}

function normalizeRevision(value: string) {
  const segment = normalizeCampaignSegment(value, "rev1");
  const numeric = segment.match(/\d+/)?.[0];

  return numeric ? `rev${numeric}` : segment.startsWith("rev") ? segment : `rev_${segment}`;
}

function normalizeSongSection(value: string | undefined) {
  const section = normalizeCampaignSegment(value || "hook", "hook");
  if (section === "full_song") return "fullsong";
  return section;
}

function getCampaignMedium(platform: string) {
  if (platform === "email") return "email";
  return "paid_social";
}

export function generateCampaignNaming(input: CampaignNamingInput): CampaignNamingOutput {
  const release = normalizeCampaignSegment(input.releaseSlug, "release");
  const visual = normalizeCampaignSegment(input.visual, "amv");
  const songSection = normalizeSongSection(input.copy?.song_section);
  const revision = normalizeRevision(input.revision);
  const platform = normalizeCampaignSegment(input.platform, "meta");
  const audience = normalizeCampaignSegment(input.audience, "broad");
  const phase = normalizeCampaignSegment(input.phase, "launch");
  const copyAngle = normalizeCampaignSegment(input.copy?.hook_type || "unlinked", "unlinked");
  const adName = [
    release,
    visual,
    songSection,
    revision,
    platform,
    audience,
    phase,
    copyAngle
  ].join("_");
  const campaignLabel = [release, phase, platform, audience].join("_");

  return {
    adName,
    campaignLabel,
    contentLabel: adName,
    utm: {
      utm_source: platform,
      utm_medium: getCampaignMedium(platform),
      utm_campaign: release,
      utm_content: adName,
      utm_term: audience
    }
  };
}
