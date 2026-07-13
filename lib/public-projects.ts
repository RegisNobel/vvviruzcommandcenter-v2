import type {PublicReleaseCategory, PublicReleaseRecord} from "@/lib/types";

export const PUBLIC_PROJECT_SLUGS = [
  "multiversus",
  "switch",
  "loverboy",
  "mi",
  "off-the-grid"
] as const;

export const PUBLIC_PROJECT_MIN_RELEASES = 2;

export type PublicProjectSlug = (typeof PUBLIC_PROJECT_SLUGS)[number];

export type PublicProjectEligibilityReason =
  | "not-allowlisted"
  | "missing-slug"
  | "missing-name"
  | "missing-description"
  | "insufficient-public-releases"
  | "missing-public-release-slug";

export type PublicProjectEligibility =
  | {eligible: true; reason: null; slug: PublicProjectSlug}
  | {eligible: false; reason: PublicProjectEligibilityReason; slug: string};

export type PublicProjectRecord = {
  description: string;
  id: string;
  latestRelease: PublicReleaseRecord;
  name: string;
  releaseCount: number;
  releases: PublicReleaseRecord[];
  representativeRelease: PublicReleaseRecord;
  slug: PublicProjectSlug;
  updatedAt: string;
};

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function isAllowlistedPublicProjectSlug(
  value: string | null | undefined
): value is PublicProjectSlug {
  const slug = normalize(value).toLowerCase();

  return PUBLIC_PROJECT_SLUGS.includes(slug as PublicProjectSlug);
}

export function evaluatePublicProjectEligibility(input: {
  description: string | null | undefined;
  name: string | null | undefined;
  publicReleaseSlugs: Array<string | null | undefined>;
  slug: string | null | undefined;
}): PublicProjectEligibility {
  const slug = normalize(input.slug).toLowerCase();

  if (!slug) {
    return {eligible: false, reason: "missing-slug", slug};
  }

  if (!isAllowlistedPublicProjectSlug(slug)) {
    return {eligible: false, reason: "not-allowlisted", slug};
  }

  if (!normalize(input.name)) {
    return {eligible: false, reason: "missing-name", slug};
  }

  if (!normalize(input.description)) {
    return {eligible: false, reason: "missing-description", slug};
  }

  if (input.publicReleaseSlugs.length < PUBLIC_PROJECT_MIN_RELEASES) {
    return {eligible: false, reason: "insufficient-public-releases", slug};
  }

  if (input.publicReleaseSlugs.some((releaseSlug) => !normalize(releaseSlug))) {
    return {eligible: false, reason: "missing-public-release-slug", slug};
  }

  return {eligible: true, reason: null, slug};
}

export function getEligibleProjectCategories<T extends PublicReleaseCategory>(
  categories: T[],
  eligibleProjectSlugs: ReadonlySet<string>
) {
  return categories.filter((category) => eligibleProjectSlugs.has(category.slug));
}

export function getPublicProjectPath(slug: string) {
  return `/projects/${encodeURIComponent(slug)}`;
}

export function getPublicProjectSeriesId(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/+$/, "")}${getPublicProjectPath(slug)}#series`;
}
