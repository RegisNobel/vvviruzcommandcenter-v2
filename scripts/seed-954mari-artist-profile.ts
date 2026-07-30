import {prisma} from "../lib/db/prisma";
import {
  createArtistPreviewVersion,
  saveArtistProfile
} from "../lib/repositories/artist-profiles";

const ARTIST_ID = "artist-profile-954mari";
const HEAVENLY_PACT_ID = "artist-release-954mari-heavenly-pact";
const VINSMOKE_ID = "artist-release-954mari-vinsmoke";
const PROFILE_IMAGE_URL =
  "https://i.scdn.co/image/ab6761610000e5ebb5dcd67b0086ee0b185b8b17";

const YOUTUBE_URL = "https://www.youtube.com/@954mari";
const SPOTIFY_URL =
  "https://open.spotify.com/artist/4B6My3qCkyAX7n3qzUZONc";
const HEAVENLY_PACT_SPOTIFY_URL =
  "https://open.spotify.com/track/450VKacpv94wRst3b3yUIB";
const VINSMOKE_SPOTIFY_URL =
  "https://open.spotify.com/track/62b895o55eArcRkV6hn3VY";

const profileLinks = [
  {
    platform: "youtube",
    label: "YouTube",
    url: YOUTUBE_URL,
    isPrimary: true
  },
  {
    platform: "spotify",
    label: "Spotify",
    url: SPOTIFY_URL
  },
  {
    platform: "apple_music",
    label: "Apple Music",
    url: "https://music.apple.com/us/artist/954mari/1459418342"
  },
  {
    platform: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/954mari/"
  },
  {
    platform: "tiktok",
    label: "TikTok",
    url: "https://www.tiktok.com/@954mari"
  },
  {
    platform: "x",
    label: "X / Twitter",
    url: "https://x.com/954mari"
  },
  {
    platform: "soundcloud",
    label: "SoundCloud",
    url: "https://soundcloud.com/954mari"
  },
  {
    platform: "website",
    label: "All links",
    url: "https://beacons.ai/954mari"
  }
];

async function upsertSupportingReleases(now: Date) {
  await prisma.release.upsert({
    where: {id: HEAVENLY_PACT_ID},
    create: {
      id: HEAVENLY_PACT_ID,
      title: "HEAVENLY PACT",
      slug: "954mari-heavenly-pact",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "DizzyEight",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b273070ac29cdbab1fb083ea2c08",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b273070ac29cdbab1fb083ea2c08",
      coverArtAltText:
        "HEAVENLY PACT by DizzyEight and 954mari cover artwork",
      type: "single",
      releaseDate: new Date("2026-02-17T12:00:00.000Z"),
      publicDescription:
        "DizzyEight and 954mari turn cursed energy, family pressure, and hard-earned conviction into a focused collaboration.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Defiant", "Focused", "High-energy"]),
      themes: JSON.stringify([
        "Jujutsu Kaisen",
        "Resilience",
        "Turning curses into strength"
      ]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: HEAVENLY_PACT_SPOTIFY_URL,
      appleMusicUrl:
        "https://music.apple.com/us/album/heavenly-pact/1878387896?i=1878387898",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      title: "HEAVENLY PACT",
      slug: "954mari-heavenly-pact",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "DizzyEight",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b273070ac29cdbab1fb083ea2c08",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b273070ac29cdbab1fb083ea2c08",
      coverArtAltText:
        "HEAVENLY PACT by DizzyEight and 954mari cover artwork",
      type: "single",
      releaseDate: new Date("2026-02-17T12:00:00.000Z"),
      publicDescription:
        "DizzyEight and 954mari turn cursed energy, family pressure, and hard-earned conviction into a focused collaboration.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Defiant", "Focused", "High-energy"]),
      themes: JSON.stringify([
        "Jujutsu Kaisen",
        "Resilience",
        "Turning curses into strength"
      ]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: HEAVENLY_PACT_SPOTIFY_URL,
      appleMusicUrl:
        "https://music.apple.com/us/album/heavenly-pact/1878387896?i=1878387898",
      updatedOn: now
    }
  });

  await prisma.release.upsert({
    where: {id: VINSMOKE_ID},
    create: {
      id: VINSMOKE_ID,
      title: "VINSMOKE",
      slug: "954mari-vinsmoke",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: false,
      collaboratorName: "",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b27304e33cac21f6f3a56ed515f2",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b27304e33cac21f6f3a56ed515f2",
      coverArtAltText: "VINSMOKE by 954mari cover artwork",
      type: "single",
      releaseDate: new Date("2026-06-12T12:00:00.000Z"),
      publicDescription:
        "A current solo release that brings 954mari's sharp delivery and anime-rooted writing into the One Piece world.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Confident", "High-energy"]),
      themes: JSON.stringify(["One Piece", "Vinsmoke family"]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "New release discovery",
        "High-energy listening"
      ]),
      spotifyUrl: VINSMOKE_SPOTIFY_URL,
      appleMusicUrl:
        "https://music.apple.com/us/album/vinsmoke-single/6777912608",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      title: "VINSMOKE",
      slug: "954mari-vinsmoke",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: false,
      collaboratorName: "",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b27304e33cac21f6f3a56ed515f2",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b27304e33cac21f6f3a56ed515f2",
      coverArtAltText: "VINSMOKE by 954mari cover artwork",
      type: "single",
      releaseDate: new Date("2026-06-12T12:00:00.000Z"),
      publicDescription:
        "A current solo release that brings 954mari's sharp delivery and anime-rooted writing into the One Piece world.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Confident", "High-energy"]),
      themes: JSON.stringify(["One Piece", "Vinsmoke family"]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "New release discovery",
        "High-energy listening"
      ]),
      spotifyUrl: VINSMOKE_SPOTIFY_URL,
      appleMusicUrl:
        "https://music.apple.com/us/album/vinsmoke-single/6777912608",
      updatedOn: now
    }
  });
}

async function main() {
  const now = new Date();
  const existingProfile = await prisma.artistProfile.findUnique({
    where: {id: ARTIST_ID},
    select: {privateContactEmail: true}
  });
  const multiversus = await prisma.release.findFirst({
    where: {
      OR: [
        {slug: "multiversus-3-john-wick-vs-sakamoto"},
        {title: {contains: "Multiversus 3"}}
      ]
    },
    select: {
      id: true,
      slug: true,
      title: true,
      coverArtUrl: true,
      coverArtPath: true,
      coverArtAltText: true,
      spotifyUrl: true
    }
  });

  if (!multiversus) {
    throw new Error(
      "The canonical Multiversus 3 release must exist before creating 954mari's preview."
    );
  }

  const longBio =
    "954mari is a Florida-based rapper, producer, and engineer building anime-inspired hip-hop with a distinctly Broward County perspective and brief nods to his Jamaican roots. After teaching himself production in 2015, he developed a catalog that moves between hard-edged solo records, character-driven concepts, and collaborations across the nerdcore scene. His hands-on approach is central to the work: writing, producing, engineering, and shaping records as parts of the same creative identity, with room to expand into R&B and neo-soul.";
  const differentiator =
    "A self-sufficient artist-producer whose anime expertise, Florida perspective, and control of both the writing and production keep the catalog personal even when the concepts are larger than life.";

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "954mari",
    displayName: "954mari",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United States",
    locationCountryCode: "US",
    themeFamily: "rose-chrome",
    longBio,
    differentiator,
    genres: ["Hip-Hop/Rap", "Nerdcore", "Anime Rap"],
    primaryCtaLabel: "Watch on YouTube",
    primaryCtaUrl: YOUTUBE_URL,
    secondaryCtaLabel: "Listen on Spotify",
    secondaryCtaUrl: SPOTIFY_URL,
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "954mari wearing a black skeleton-styled outfit in front of painted pink and red wings",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Built from the beat up.",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Multiversus 3",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from 954mari",
      platformLabel: "Find 954mari"
    },
    seoTitle: "954mari | Artist Profile",
    seoDescription:
      "Explore 954mari, a Florida rapper, producer, and engineer making anime-inspired hip-hop with a self-built creative identity.",
    socialImageUrl: PROFILE_IMAGE_URL,
    links: profileLinks,
    featuredItems: [],
    featuredStories: []
  });

  await upsertSupportingReleases(now);

  await prisma.releaseArtistCredit.upsert({
    where: {
      releaseId_artistProfileId_role: {
        releaseId: multiversus.id,
        artistProfileId: ARTIST_ID,
        role: "COLLABORATOR"
      }
    },
    create: {
      id: `credit-${multiversus.id}-954mari`,
      releaseId: multiversus.id,
      artistProfileId: ARTIST_ID,
      role: "COLLABORATOR",
      displayOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    update: {displayOrder: 0, updatedAt: now}
  });

  const startHereCover =
    multiversus.coverArtUrl || multiversus.coverArtPath || "";

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "954mari",
    displayName: "954mari",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United States",
    locationCountryCode: "US",
    themeFamily: "rose-chrome",
    longBio,
    differentiator,
    genres: ["Hip-Hop/Rap", "Nerdcore", "Anime Rap"],
    primaryCtaLabel: "Watch on YouTube",
    primaryCtaUrl: YOUTUBE_URL,
    secondaryCtaLabel: "Listen on Spotify",
    secondaryCtaUrl: SPOTIFY_URL,
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "954mari wearing a black skeleton-styled outfit in front of painted pink and red wings",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Built from the beat up.",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Multiversus 3",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from 954mari",
      platformLabel: "Find 954mari"
    },
    seoTitle: "954mari | Artist Profile",
    seoDescription:
      "Explore 954mari, a Florida rapper, producer, and engineer making anime-inspired hip-hop with a self-built creative identity.",
    socialImageUrl: PROFILE_IMAGE_URL,
    expansion: {
      catalogEnabled: false,
      catalogTitle: "Releases",
      catalogIntro: "",
      catalogCtaLabel: "View all releases",
      catalogReleaseIds: [
        multiversus.id,
        HEAVENLY_PACT_ID,
        VINSMOKE_ID
      ],
      editorialReleaseIds: [multiversus.id],
      featuredStoriesEnabled: false,
      featuredStoriesLabel: "Featured stories",
      featuredStoriesHeading: "Go deeper"
    },
    links: profileLinks,
    featuredItems: [
      {
        releaseId: multiversus.id,
        itemType: "collaboration",
        eyebrow: "Start Here",
        title: multiversus.title,
        subtitle: "2026 · vvviruz × 954mari",
        description:
          "A cinematic John Wick versus Taro Sakamoto battle built around precision, pressure, and a hook designed to hit.",
        url:
          multiversus.spotifyUrl ||
          `/music/${multiversus.slug}`,
        coverArtUrl: startHereCover,
        coverArtAlt:
          multiversus.coverArtAltText ||
          "Multiversus 3 by vvviruz featuring 954mari cover artwork",
        isStartHere: true
      },
      {
        releaseId: HEAVENLY_PACT_ID,
        itemType: "collaboration",
        eyebrow: "More from 954mari",
        title: "HEAVENLY PACT",
        subtitle: "2026 · with DizzyEight",
        description:
          "A focused collaboration about turning cursed energy, family pressure, and pain into conviction.",
        url: HEAVENLY_PACT_SPOTIFY_URL,
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b273070ac29cdbab1fb083ea2c08",
        coverArtAlt:
          "HEAVENLY PACT by DizzyEight and 954mari cover artwork",
        isStartHere: false
      },
      {
        releaseId: VINSMOKE_ID,
        itemType: "single",
        eyebrow: "More from 954mari",
        title: "VINSMOKE",
        subtitle: "2026 · latest release",
        description:
          "A current solo signal that brings 954mari's sharp delivery into the One Piece world.",
        url: VINSMOKE_SPOTIFY_URL,
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b27304e33cac21f6f3a56ed515f2",
        coverArtAlt: "VINSMOKE by 954mari cover artwork",
        isStartHere: false
      }
    ],
    featuredStories: []
  });

  const preview = await createArtistPreviewVersion(ARTIST_ID);
  console.log(
    JSON.stringify(
      {
        artistProfileId: ARTIST_ID,
        adminPath: `/admin/artists/${ARTIST_ID}`,
        previewPath: `/preview/artists/${preview.token}`,
        editorialPath: `/preview/artists/${preview.token}/music/${multiversus.slug}`,
        version: preview.version,
        expiresAt: preview.previewExpiresAt
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
