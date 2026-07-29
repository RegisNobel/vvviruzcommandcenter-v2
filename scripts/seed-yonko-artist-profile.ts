import {prisma} from "../lib/db/prisma";
import {
  createArtistPreviewVersion,
  saveArtistProfile
} from "../lib/repositories/artist-profiles";

const ARTIST_ID = "artist-profile-yonko";
const SOMETHING_GOOD_ID = "release-something-good-yonko-vvviruz";

async function main() {
  const now = new Date();
  const existingProfile = await prisma.artistProfile.findUnique({
    where: {id: ARTIST_ID},
    select: {privateContactEmail: true}
  });
  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "yonko",
    displayName: "YONKO",
    privateContactEmail:
      process.env.YONKO_PRIVATE_CONTACT_EMAIL?.trim() ||
      existingProfile?.privateContactEmail ||
      "",
    location: "Egypt",
    locationCountryCode: "EG",
    themeFamily: "signal-noir",
    longBio:
      "YONKO moves between melodic storytelling, confident flows, and hard-hitting performances without flattening those modes into one sound. Working across trap, drill, R&B, and flashes of troll rap, the Egypt-based artist writes for emotional impact and live-wire energy. Much of the music is self-produced, keeping the full creative chain close — from the first idea to the final delivery.",
    differentiator:
      "Strong delivery meets full creative control. YONKO’s production background lets him shape records from the inside out, shifting from melodic to aggressive without losing identity.",
    genres: ["Trap", "Drill", "R&B", "Troll rap"],
    primaryCtaLabel: "Start with Something good",
    primaryCtaUrl: "https://open.spotify.com/track/3qceBC43IHqDyjfJZOzQw7",
    secondaryCtaLabel: "Explore on YouTube",
    secondaryCtaUrl: "https://www.youtube.com/@YonkoMusic999",
    profileImagePath: "/artists/yonko/profile.webp",
    profileImageAlt: "Illustrated close-up portrait selected by YONKO",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Field notes",
      storyHeading: "Melody under pressure.",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Listen now",
      selectedLabel: "02 / Selected signals",
      selectedHeading: "More from YONKO",
      platformLabel: "Follow the signal"
    },
    seoTitle: "YONKO — Artist Profile",
    seoDescription:
      "Meet YONKO, an Egypt-based hip-hop artist pairing melodic storytelling with confident flows and hard-hitting energy.",
    socialImageUrl: "/artists/yonko/profile.webp",
    links: [
      {platform: "youtube", label: "YouTube", url: "https://www.youtube.com/@YonkoMusic999", isPrimary: true},
      {platform: "spotify", label: "Spotify", url: "https://open.spotify.com/artist/191HXJA9IIN7ZOBidlgv64"},
      {platform: "apple-music", label: "Apple Music", url: "https://music.apple.com/us/artist/yonko/1890988620"},
      {platform: "x", label: "X", url: "https://x.com/YONKO_101"},
      {platform: "instagram", label: "Instagram", url: "https://www.instagram.com/yonkomusic999/"},
      {platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@yonk0999"},
      {platform: "discord", label: "Discord", url: "https://discord.gg/qKUQ4wjNUS"}
    ],
    featuredItems: [
      {
        itemType: "single",
        eyebrow: "Start here / Shared signal",
        title: "Something good",
        subtitle: "YONKO × vvviruz",
        description:
          "A melodic collaboration that puts YONKO’s emotional instinct and clean delivery at the center.",
        url: "https://open.spotify.com/track/3qceBC43IHqDyjfJZOzQw7",
        coverArtUrl: "https://i.scdn.co/image/ab67616d0000b273e63b6ea2e00a36589fc7ff94",
        coverArtAlt: "Something good single artwork",
        isStartHere: true
      },
      {
        itemType: "album",
        eyebrow: "Album",
        title: "Crossfire",
        subtitle: "YONKO",
        description: "A full-length look at YONKO’s melodic and hard-edged range.",
        url: "https://open.spotify.com/album/01VcHKTZb2YtmL2j8ZBGzE",
        coverArtUrl: "https://i.scdn.co/image/ab67616d0000b2738ece431251bdaf8295182459",
        coverArtAlt: "Crossfire album artwork",
        isStartHere: false
      },
      {
        itemType: "collaboration",
        eyebrow: "vvviruz collaboration",
        title: "Will",
        subtitle: "Wistoria: Wand & Sword Rap · feat. YONKO",
        description: "A high-energy collaboration built around resolve, pressure, and forward motion.",
        url: "https://open.spotify.com/album/3gwXEzUfgZ0loiQ3pJ3Lcl",
        coverArtUrl: "https://i.scdn.co/image/ab67616d0000b2737207dbc5818f5f2c86716c20",
        coverArtAlt: "Will single artwork in blue and violet tones",
        isStartHere: false
      }
    ]
  });

  await prisma.release.upsert({
    where: {id: SOMETHING_GOOD_ID},
    create: {
      id: SOMETHING_GOOD_ID,
      title: "Something good",
      slug: "something-good",
      collaborator: true,
      collaboratorName: "YONKO",
      coverArtUrl: "https://i.scdn.co/image/ab67616d0000b273e63b6ea2e00a36589fc7ff94",
      coverArtAltText: "Something good single artwork",
      publicDescription: "A melodic collaboration from YONKO and vvviruz.",
      spotifyUrl: "https://open.spotify.com/track/3qceBC43IHqDyjfJZOzQw7",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      collaborator: true,
      collaboratorName: "YONKO",
      coverArtUrl: "https://i.scdn.co/image/ab67616d0000b273e63b6ea2e00a36589fc7ff94",
      coverArtAltText: "Something good single artwork",
      publicDescription: "A melodic collaboration from YONKO and vvviruz.",
      spotifyUrl: "https://open.spotify.com/track/3qceBC43IHqDyjfJZOzQw7",
      updatedOn: now
    }
  });

  const will = await prisma.release.findUnique({where: {slug: "will-wistoria-rap"}, select: {id: true}});
  for (const releaseId of [SOMETHING_GOOD_ID, will?.id].filter((value): value is string => Boolean(value))) {
    await prisma.releaseArtistCredit.upsert({
      where: {
        releaseId_artistProfileId_role: {
          releaseId,
          artistProfileId: ARTIST_ID,
          role: "COLLABORATOR"
        }
      },
      create: {
        id: `credit-${releaseId}-yonko`,
        releaseId,
        artistProfileId: ARTIST_ID,
        role: "COLLABORATOR",
        displayOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      update: {displayOrder: 0, updatedAt: now}
    });
  }

  if (will) {
    await prisma.release.update({
      where: {id: will.id},
      data: {
        collaborator: true,
        collaboratorName: "YONKO",
        coverArtUrl: "https://i.scdn.co/image/ab67616d0000b2737207dbc5818f5f2c86716c20",
        coverArtAltText: "Will single artwork",
        spotifyUrl: "https://open.spotify.com/album/3gwXEzUfgZ0loiQ3pJ3Lcl",
        updatedOn: now
      }
    });
  }

  const preview = await createArtistPreviewVersion(ARTIST_ID);
  console.log(JSON.stringify({
    artistProfileId: ARTIST_ID,
    adminPath: `/admin/artists/${ARTIST_ID}`,
    previewPath: `/preview/artists/${preview.token}`,
    version: preview.version
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
