import {prisma} from "../lib/db/prisma";
import {
  createArtistPreviewVersion,
  saveArtistProfile
} from "../lib/repositories/artist-profiles";

const ARTIST_ID = "artist-profile-jamar-rose";
const SHIBUYA_ISRC = "QT6EV2531355";
const PROFILE_IMAGE_URL =
  "https://der42gjtvxvutavf.public.blob.vercel-storage.com/vvviruz/artists/jamar-rose/profile.webp";

async function main() {
  const now = new Date();
  const existingProfile = await prisma.artistProfile.findUnique({
    where: {id: ARTIST_ID},
    select: {privateContactEmail: true}
  });
  const shibuya = await prisma.release.findFirst({
    where: {
      OR: [
        {isrc: SHIBUYA_ISRC},
        {slug: {startsWith: "shibuya-"}},
        {title: "Shibuya"}
      ]
    },
    select: {id: true, slug: true}
  });

  if (!shibuya) {
    throw new Error(
      "Shibuya must exist in the vvviruz catalog before creating Jamar Rose's preview."
    );
  }

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "jamarrose",
    displayName: "Jamar Rose",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United States",
    locationCountryCode: "US",
    themeFamily: "crimson-voltage",
    longBio:
      "Jamar Rose builds high-energy hip-hop around anime and game worlds, turning character concepts into direct, performance-first records. Across solo songs, project cuts, and collaborations, the United States-based artist pairs forceful delivery and punchline-heavy writing with a hands-on role in the finished presentation, frequently handling mixing, mastering, video editing, and thumbnail work. That range keeps the catalog connected by voice and execution without limiting it to one franchise or one kind of record.",
    differentiator:
      "An artist-builder approach: sharp character writing, explosive delivery, and hands-on control across audio and visual presentation.",
    genres: ["Hip-Hop/Rap", "Nerdcore", "Anime Rap", "Video Game Rap"],
    primaryCtaLabel: "Watch on YouTube",
    primaryCtaUrl: "https://www.youtube.com/@JamarRose",
    secondaryCtaLabel: "Listen on Spotify",
    secondaryCtaUrl:
      "https://open.spotify.com/artist/5eRDVS3cobE2WOM8xrjdOw",
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "Jamar Rose performing live under blue and magenta stage lighting",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Built for impact.",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Shibuya",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from Jamar Rose",
      platformLabel: "Find Jamar Rose"
    },
    seoTitle: "Jamar Rose | Artist Profile",
    seoDescription:
      "Explore Jamar Rose, a United States-based hip-hop and nerdcore artist pairing explosive delivery with hands-on audio and visual craft.",
    socialImageUrl: PROFILE_IMAGE_URL,
    expansion: {
      catalogEnabled: false,
      catalogTitle: "Releases",
      catalogIntro: "",
      catalogCtaLabel: "View all releases",
      catalogReleaseIds: [],
      editorialReleaseIds: [shibuya.id],
      featuredStoriesEnabled: false,
      featuredStoriesLabel: "Featured stories",
      featuredStoriesHeading: "Go deeper"
    },
    links: [
      {
        platform: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/@JamarRose",
        isPrimary: true
      },
      {
        platform: "spotify",
        label: "Spotify",
        url: "https://open.spotify.com/artist/5eRDVS3cobE2WOM8xrjdOw"
      },
      {
        platform: "apple_music",
        label: "Apple Music",
        url: "https://music.apple.com/us/artist/jamar-rose/1516402599"
      },
      {
        platform: "instagram",
        label: "Instagram",
        url: "https://www.instagram.com/jamarrose_/"
      },
      {
        platform: "x",
        label: "X / Twitter",
        url: "https://x.com/JamarRose_"
      },
      {
        platform: "soundcloud",
        label: "SoundCloud",
        url: "https://soundcloud.com/jamarrose"
      }
    ],
    featuredItems: [
      {
        releaseId: shibuya.id,
        itemType: "collaboration",
        eyebrow: "Start Here",
        title: "Shibuya",
        subtitle: "2025 · Jujutsu Kaisen Rap",
        description: "vvviruz feat. Jamar Rose",
        url: "https://www.youtube.com/watch?v=vyT8kzYnM4c",
        coverArtUrl:
          "/api/assets/cover/2463f055-1f2f-41b0-bc56-bbef07afedf5.jpg",
        coverArtAlt:
          "Shibuya by vvviruz featuring Jamar Rose cover artwork",
        isStartHere: true
      },
      {
        itemType: "collaboration",
        eyebrow: "More from Jamar Rose",
        title: "WHAT A DRAG",
        subtitle: "2024 · with KING MARCEL and SHAAH",
        description:
          "A DANDADAN-inspired collaboration mixed, mastered, and video-edited by Jamar Rose.",
        url: "https://www.youtube.com/watch?v=QTLh7gRoZTk",
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b273de11aa805ce9c4fad3d766f3",
        coverArtAlt: "WHAT A DRAG single cover artwork",
        isStartHere: false
      },
      {
        itemType: "single",
        eyebrow: "More from Jamar Rose",
        title: "BLITZ",
        subtitle: "2026 · Dragon Ball Super Rap",
        description:
          "A solo Gogeta record mixed and mastered by Jamar Rose.",
        url: "https://www.youtube.com/watch?v=hHxniKsoW2Q",
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b2739ffa0be005046398bea40f8f",
        coverArtAlt: "BLITZ single cover artwork",
        isStartHere: false
      }
    ]
  });

  await prisma.release.update({
    where: {id: shibuya.id},
    data: {
      collaborator: true,
      collaboratorName: "Jamar Rose",
      releaseDate: new Date("2025-12-10T00:00:00.000Z"),
      coverArtAltText:
        "Shibuya by vvviruz featuring Jamar Rose cover artwork",
      inspirationContext:
        "A Jujutsu Kaisen-inspired track built around the chaos and pressure of the Shibuya Incident, using character references, cursed techniques, and multilingual writing to keep the record moving like a confrontation.",
      languages: JSON.stringify(["English", "Spanish", "French"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore"]),
      moods: JSON.stringify(["High-energy", "Aggressive"]),
      themes: JSON.stringify([
        "Jujutsu Kaisen",
        "Shibuya Incident",
        "Cursed energy"
      ]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      featuredVideoUrl: "https://www.youtube.com/watch?v=vyT8kzYnM4c",
      updatedOn: now
    }
  });

  await prisma.releaseArtistCredit.upsert({
    where: {
      releaseId_artistProfileId_role: {
        releaseId: shibuya.id,
        artistProfileId: ARTIST_ID,
        role: "COLLABORATOR"
      }
    },
    create: {
      id: `credit-${shibuya.id}-jamar-rose`,
      releaseId: shibuya.id,
      artistProfileId: ARTIST_ID,
      role: "COLLABORATOR",
      displayOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    update: {displayOrder: 0, updatedAt: now}
  });

  const preview = await createArtistPreviewVersion(ARTIST_ID);
  console.log(
    JSON.stringify(
      {
        artistProfileId: ARTIST_ID,
        adminPath: `/admin/artists/${ARTIST_ID}`,
        previewPath: `/preview/artists/${preview.token}`,
        editorialPath: `/preview/artists/${preview.token}/music/${shibuya.slug}`,
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
