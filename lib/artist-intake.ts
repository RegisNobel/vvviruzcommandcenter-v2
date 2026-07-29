import {z} from "zod";

import {
  ARTIST_THEME_FAMILIES,
  DEFAULT_ARTIST_THEME_FAMILY
} from "@/lib/artist-profiles";

const shortText = z.string().trim().max(240);
const longText = z.string().trim().max(20_000);
const textList = z.array(z.string().trim().max(120)).max(20);
const optionalUrl = z
  .string()
  .trim()
  .max(2_000)
  .refine(
    (value) => !value || /^https?:\/\//i.test(value),
    "Links must begin with http:// or https://."
  );

export const ARTIST_INTAKE_LINKS = [
  {platform: "website", label: "Website"},
  {platform: "youtube", label: "YouTube"},
  {platform: "spotify", label: "Spotify"},
  {platform: "apple-music", label: "Apple Music"},
  {platform: "instagram", label: "Instagram"},
  {platform: "tiktok", label: "TikTok"},
  {platform: "x", label: "X"},
  {platform: "discord", label: "Discord"}
] as const;

export const ARTIST_INTAKE_RELEASE_TYPES = [
  "Single",
  "EP",
  "Album",
  "Mixtape",
  "Collaboration",
  "Other"
] as const;

export const artistIntakeBreakdownSchema = z.object({
  id: shortText,
  lyricExcerpt: longText,
  explanation: longText,
  referenceUrl: optionalUrl
});

export const artistIntakeReleaseSchema = z.object({
  id: shortText,
  title: shortText,
  type: shortText,
  releaseDate: shortText,
  spotifyUrl: optionalUrl,
  appleMusicUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  coverArtUrl: optionalUrl,
  coverArtAlt: shortText,
  coverArtRightsConfirmed: z.boolean().default(false),
  featuredVideoUrl: optionalUrl,
  isFeatured: z.boolean(),
  collaborators: longText,
  credits: longText,
  trackSummary: longText,
  languages: textList,
  genres: textList,
  moods: textList,
  themes: textList,
  listenerContexts: textList,
  lyrics: longText,
  lyricsRightsConfirmed: z.boolean(),
  breakdowns: z.array(artistIntakeBreakdownSchema).max(5)
});

export const artistIntakeResponseSchema = z.object({
  schemaVersion: z.literal(1),
  artist: z.object({
    displayName: shortText,
    contactEmail: z.string().trim().max(320),
    countryCode: z.string().trim().max(2),
    themeFamily: z.enum(
      ARTIST_THEME_FAMILIES.map((theme) => theme.value) as [
        (typeof ARTIST_THEME_FAMILIES)[number]["value"],
        ...(typeof ARTIST_THEME_FAMILIES)[number]["value"][]
      ]
    ),
    profileImageUrl: optionalUrl,
    profileImageAlt: shortText,
    imageRightsConfirmed: z.boolean(),
    soundDescription: longText,
    differentiator: longText,
    genres: textList
  }),
  links: z
    .array(
      z.object({
        platform: shortText,
        label: shortText,
        url: optionalUrl
      })
    )
    .max(12),
  releases: z.array(artistIntakeReleaseSchema).min(1).max(3),
  additionalNotes: longText,
  submissionConfirmed: z.boolean()
});

export const artistIntakeSubmissionSchema =
  artistIntakeResponseSchema.superRefine((response, context) => {
    if (!response.artist.displayName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Artist name is required.",
        path: ["artist", "displayName"]
      });
    }
    if (!z.string().email().safeParse(response.artist.contactEmail).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid contact email.",
        path: ["artist", "contactEmail"]
      });
    }
    if (response.artist.countryCode.length !== 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a public country.",
        path: ["artist", "countryCode"]
      });
    }
    if (!response.artist.profileImageUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a profile image URL or upload an image.",
        path: ["artist", "profileImageUrl"]
      });
    }
    if (response.artist.profileImageUrl && !response.artist.imageRightsConfirmed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm that the profile image can be used publicly.",
        path: ["artist", "imageRightsConfirmed"]
      });
    }
    if (!response.artist.soundDescription) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell us how you describe your sound.",
        path: ["artist", "soundDescription"]
      });
    }
    if (!response.artist.differentiator) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell us what makes your work distinct.",
        path: ["artist", "differentiator"]
      });
    }
    if (!response.artist.genres.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one genre.",
        path: ["artist", "genres"]
      });
    }

    const featuredReleases = response.releases.filter((release) => release.isFeatured);
    if (featuredReleases.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose exactly one release as Start Here.",
        path: ["releases"]
      });
    }

    response.releases.forEach((release, index) => {
      if (!release.title) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Release ${index + 1} needs a title.`,
          path: ["releases", index, "title"]
        });
      }
      if (!release.spotifyUrl && !release.appleMusicUrl && !release.youtubeUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${release.title || `Release ${index + 1}`} needs at least one listening link.`,
          path: ["releases", index, "spotifyUrl"]
        });
      }
      if (!release.coverArtUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${release.title || `Release ${index + 1}`} needs cover art.`,
          path: ["releases", index, "coverArtUrl"]
        });
      }
      if (release.coverArtUrl && !release.coverArtRightsConfirmed) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Confirm public-use permission for ${release.title || `release ${index + 1}`} cover art.`,
          path: ["releases", index, "coverArtRightsConfirmed"]
        });
      }
      if (release.isFeatured && !release.trackSummary) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The Start Here release needs a track profile summary.",
          path: ["releases", index, "trackSummary"]
        });
      }
      if (release.lyrics && !release.lyricsRightsConfirmed) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Confirm lyric-display permission for the submitted lyrics.",
          path: ["releases", index, "lyricsRightsConfirmed"]
        });
      }
      release.breakdowns.forEach((breakdown, breakdownIndex) => {
        if (!breakdown.lyricExcerpt || !breakdown.explanation) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each breakdown needs both a lyric excerpt and an explanation.",
            path: ["releases", index, "breakdowns", breakdownIndex]
          });
        }
      });
    });

    if (!response.submissionConfirmed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm the submission before sending it.",
        path: ["submissionConfirmed"]
      });
    }
  });

export type ArtistIntakeResponse = z.infer<typeof artistIntakeResponseSchema>;
export type ArtistIntakeRelease = z.infer<typeof artistIntakeReleaseSchema>;
export type ArtistIntakeBreakdown = z.infer<typeof artistIntakeBreakdownSchema>;

export function createEmptyArtistIntakeRelease(
  isFeatured = false
): ArtistIntakeRelease {
  return {
    id: crypto.randomUUID(),
    title: "",
    type: "Single",
    releaseDate: "",
    spotifyUrl: "",
    appleMusicUrl: "",
    youtubeUrl: "",
    coverArtUrl: "",
    coverArtAlt: "",
    coverArtRightsConfirmed: false,
    featuredVideoUrl: "",
    isFeatured,
    collaborators: "",
    credits: "",
    trackSummary: "",
    languages: [],
    genres: [],
    moods: [],
    themes: [],
    listenerContexts: [],
    lyrics: "",
    lyricsRightsConfirmed: false,
    breakdowns: []
  };
}

export function createEmptyArtistIntakeResponse(
  artistName = "",
  contactEmail = ""
): ArtistIntakeResponse {
  return {
    schemaVersion: 1,
    artist: {
      displayName: artistName,
      contactEmail,
      countryCode: "",
      themeFamily: DEFAULT_ARTIST_THEME_FAMILY,
      profileImageUrl: "",
      profileImageAlt: "",
      imageRightsConfirmed: false,
      soundDescription: "",
      differentiator: "",
      genres: []
    },
    links: ARTIST_INTAKE_LINKS.map((link) => ({...link, url: ""})),
    releases: [createEmptyArtistIntakeRelease(true)],
    additionalNotes: "",
    submissionConfirmed: false
  };
}

export function parseArtistIntakeResponse(
  value: string,
  artistName = "",
  contactEmail = ""
) {
  try {
    const parsed = artistIntakeResponseSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Fall back to a clean intake if a legacy or malformed draft is encountered.
  }
  return createEmptyArtistIntakeResponse(artistName, contactEmail);
}
