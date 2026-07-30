import {prisma} from "../lib/db/prisma";
import {parseCanonicalLyrics} from "../lib/lyrics";
import {
  createArtistPreviewVersion,
  saveArtistProfile
} from "../lib/repositories/artist-profiles";
import {createReleaseAnnotationAnchor} from "../lib/server/release-annotation-anchors";

const ARTIST_ID = "artist-profile-dripstick";
const BIG_RUSHI_ID = "artist-release-dripstick-big-rushi";
const WORST_WAY_ID = "artist-release-dripstick-worst-way";
const PROFILE_IMAGE_URL =
  "https://i.scdn.co/image/ab6761610000e5ebbe0ac8b2e42e354760c51e49";
const MAHORAGA_LYRICS = `Hook
With a sacred treasure
they calling up raga//
wanna claim the top spot
im the final ladder//
divine general - mahoraga//
its big raga
the opp stoppa//

[verse 1]
when it comes to the strongest you know im the bar
you boutta to cooked if im spinning the wheel//
taking you out and you pay the
im taking you out and you pay the bill
price for squaring up with the general
down in the shibuya this isnt a drill//
all of your hope gone up in flames
if it aint talkin fuga then Raga is chill//

[verse 2]
Mahoraga way im stomping em out
They don’t know where I came from
All of these sorcerers summoned me none of them came back alive it was funny they playing dumb
Wings on my head I’m on a different plane bruh
I dont even gotta speak but the way that I’m fighting is saying sumn
Watch when I fade ya, positive energy sword on my hip yeah I’m swinging these blades up

[Verse 3]
with the exception of gojo of course
enough with the glaze, i said what i said//
me and sukuna we put him to bed
sending him straight to the land of the dead//
he spamming that blue but my vision is red
red red red red
thought you were limitless – this is your limit?
blue in your eyes but you leaking out red//

Chorus
With this sacred treasure
you calling up raga//
wanna claim the top spot
im the final ladder//
divine general - mahoraga//
its big raga
the opp stoppa//

[verse 4]
Pull up and I just one tap you,
You think you the best I adapt to any attack, one slash I might trash you
And if sukuna didn’t have fuga
Then I probably would’ve just turned him to ash too
In Shibuya they seeing me post up
Monumental I’m sumn like a statue
Spinning on the opposition I have to

[verse 5]
spin  -  spin
wheel on my back turning again//
i am the test for the best of the best
final exam - you fail if you lame//
evolve or you die but i die and evolve
raga is changing the rules of the game//
check out the lore - went 0 and 4
but homie my aura staying the same//

[verse 6]
Discord, way they seeing this general chatting
I’m making madness, been blowing in the scene like the city don’t know what happened
You wanna box and I’m getting em locked up,
Flat tire
see the wheel when I pop up
you got one hit it’s a loss bruh
Already know who they calling it’s raga

Chorus
With this sacred treasure
you calling up raga//
wanna claim the top spot
im the final ladder//
divine general - mahoraga//
its big raga
the opp stoppa//`;

const profileLinks = [
  {
    platform: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/@DripStick",
    isPrimary: true
  },
  {
    platform: "spotify",
    label: "Spotify",
    url: "https://open.spotify.com/artist/6ZJvO3Bep601OM4V5bgm8q"
  },
  {
    platform: "apple_music",
    label: "Apple Music",
    url: "https://music.apple.com/us/artist/drip%24tick/1461673217"
  },
  {
    platform: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/dripstick7/"
  },
  {
    platform: "tiktok",
    label: "TikTok",
    url: "https://www.tiktok.com/@dripstick7"
  },
  {
    platform: "x",
    label: "X / Twitter",
    url: "https://x.com/dripstick_"
  },
  {
    platform: "soundcloud",
    label: "SoundCloud",
    url: "https://soundcloud.com/dripstick"
  }
];

function findAnnotationAnchor(lyrics: string, excerptLines: string[]) {
  const document = parseCanonicalLyrics(lyrics);

  for (const section of document.sections) {
    const lines = section.lines.map((line) => line.text);
    for (let start = 0; start <= lines.length - excerptLines.length; start += 1) {
      const matches = excerptLines.every(
        (line, offset) => lines[start + offset] === line
      );
      if (!matches) continue;

      return createReleaseAnnotationAnchor({
        lyrics,
        sectionKey: section.key,
        sectionOccurrence: section.occurrence,
        startLineIndex: start,
        endLineIndex: start + excerptLines.length - 1
      });
    }
  }

  throw new Error(
    `Could not anchor annotation excerpt: ${excerptLines.join(" / ")}`
  );
}

async function upsertEditorialAnnotations(releaseId: string, lyrics: string) {
  const now = new Date();
  const annotations = [
    {
      id: "annotation-mahoraga-sacred-treasure",
      type: "character_lore",
      excerptLines: [
        "With a sacred treasure",
        "they calling up raga//",
        "wanna claim the top spot",
        "im the final ladder//"
      ],
      title: "The summoning phrase becomes the hook",
      summary:
        "Mahoraga's ritual introduction is recast as both a warning and a claim to the final rung.",
      explanation:
        "The hook starts from the Ten Shadows summoning language and turns it into competitive rap framing. Calling Mahoraga the “final ladder” positions the Divine General as the last test between a challenger and the top spot."
    },
    {
      id: "annotation-mahoraga-wheel",
      type: "character_lore",
      excerptLines: [
        "spin  -  spin",
        "wheel on my back turning again//",
        "i am the test for the best of the best",
        "final exam - you fail if you lame//"
      ],
      title: "Adaptation as a final exam",
      summary:
        "The wheel's rotation becomes a test that punishes anyone unable to evolve quickly enough.",
      explanation:
        "Mahoraga's wheel signals adaptation. The verse translates that mechanic into battle-rap stakes: every rotation changes the matchup, and surviving the encounter becomes an exam reserved for the strongest."
    },
    {
      id: "annotation-mahoraga-blue-red",
      type: "anime_reference",
      excerptLines: [
        "he spamming that blue but my vision is red",
        "red red red red",
        "thought you were limitless – this is your limit?",
        "blue in your eyes but you leaking out red//"
      ],
      title: "Gojo's colors turn against him",
      summary:
        "Blue, Red, Limitless, and Gojo's eyes are compressed into one taunt about reaching a limit.",
      explanation:
        "The color language points to Gojo's Blue and Red techniques while “limitless” flips the name of his inherited technique into an accusation. The last line changes blue eyes into spilled red, closing the sequence with a visual threat."
    },
    {
      id: "annotation-mahoraga-zero-four",
      type: "metaphor_wordplay",
      excerptLines: [
        "evolve or you die but i die and evolve",
        "raga is changing the rules of the game//",
        "check out the lore - went 0 and 4",
        "but homie my aura staying the same//"
      ],
      title: "The record survives the record",
      summary:
        "A losing battle history is reframed as proof that Mahoraga's aura outlives the scoreboard.",
      explanation:
        "The “0 and 4” line acknowledges that Mahoraga's major matchups do not end in conventional wins. The surrounding adaptation bars refuse to treat that record as weakness: each defeat adds to the mythology, so the presence remains intact even when the result does not."
    }
  ];

  for (const [sortOrder, annotation] of annotations.entries()) {
    const anchor = findAnnotationAnchor(lyrics, annotation.excerptLines);
    await prisma.releaseAnnotation.upsert({
      where: {id: annotation.id},
      create: {
        id: annotation.id,
        releaseId,
        type: annotation.type,
        lyricExcerpt: anchor.excerptSnapshot,
        ...anchor,
        title: annotation.title,
        summary: annotation.summary,
        explanation: annotation.explanation,
        status: "ready",
        confidence: "interpretive",
        isPublic: true,
        sortOrder,
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now
      },
      update: {
        type: annotation.type,
        lyricExcerpt: anchor.excerptSnapshot,
        ...anchor,
        title: annotation.title,
        summary: annotation.summary,
        explanation: annotation.explanation,
        status: "ready",
        confidence: "interpretive",
        isPublic: true,
        sortOrder,
        lastReviewedAt: now,
        updatedAt: now
      }
    });
  }
}

async function main() {
  const now = new Date();
  const existingProfile = await prisma.artistProfile.findUnique({
    where: {id: ARTIST_ID},
    select: {privateContactEmail: true}
  });
  const mahoraga = await prisma.release.findFirst({
    where: {
      catalogScope: "VVVIRUZ",
      OR: [{slug: "mahoraga"}, {title: "Mahoraga"}]
    },
    select: {
      id: true,
      slug: true,
      lyrics: true,
      coverArtPath: true,
      coverArtUrl: true
    }
  });

  if (!mahoraga) {
    throw new Error(
      "Mahoraga must exist in the vvviruz catalog before creating Drip$tick's preview."
    );
  }
  if (!mahoraga.lyrics.trim()) {
    throw new Error("Mahoraga's canonical lyrics are empty.");
  }

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "dripstick",
    displayName: "Drip$tick",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United States",
    locationCountryCode: "US",
    themeFamily: "violet-haze",
    longBio:
      "Drip$tick is a United States-based hip-hop artist and LOOP FX member building character-driven rap around anime, gaming, and internet culture. His catalog moves between antagonistic character perspectives, dense punchlines, and collaborative scene records, with the 2025 projects ALIEN and C B D $ W I B ? leading into an active run of Jujutsu Kaisen-inspired releases in 2026.",
    differentiator:
      "Character-first writing with an antagonist's edge: Drip$tick turns anime lore into punchlines, diss records, and scene-wide collaborations without losing a recognizable voice.",
    genres: ["Hip-Hop/Rap", "Nerdcore", "Anime Rap"],
    primaryCtaLabel: "Watch on YouTube",
    primaryCtaUrl: "https://www.youtube.com/@DripStick",
    secondaryCtaLabel: "Listen on Spotify",
    secondaryCtaUrl:
      "https://open.spotify.com/artist/6ZJvO3Bep601OM4V5bgm8q",
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "Illustrated close-up avatar of Drip$tick with violet star-filled eyes",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Who is Drip?",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Mahoraga",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from Drip$tick",
      platformLabel: "Find Drip$tick"
    },
    seoTitle: "Drip$tick | Artist Profile",
    seoDescription:
      "Explore Drip$tick, a United States-based hip-hop and nerdcore artist turning anime lore into character-driven records, punchlines, and collaborations.",
    socialImageUrl: PROFILE_IMAGE_URL,
    links: profileLinks,
    featuredItems: [],
    featuredStories: []
  });

  await prisma.release.upsert({
    where: {id: BIG_RUSHI_ID},
    create: {
      id: BIG_RUSHI_ID,
      title: "BIG RUSHI",
      slug: "dripstick-big-rushi",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b273b2fda15cbced407706b1cfc8",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b273b2fda15cbced407706b1cfc8",
      coverArtAltText: "BIG RUSHI single cover artwork",
      type: "nerdcore",
      releaseDate: new Date("2026-04-10T00:00:00.000Z"),
      publicDescription:
        "A Kurourushi-centered Jujutsu Kaisen diss record that turns adaptation, swarm imagery, and a Yuta matchup into a compact solo showcase.",
      inspirationContext:
        "Written from Kurourushi's perspective, BIG RUSHI frames the Sendai Colony fight as a direct Yuta diss and builds its punchlines around cursed tools, roaches, domains, and survival.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Aggressive", "Playful", "High-energy"]),
      themes: JSON.stringify([
        "Jujutsu Kaisen",
        "Kurourushi",
        "Sendai Colony",
        "Battle rap"
      ]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: "https://open.spotify.com/album/79sBY2hIBusrqxX2dwOVgc",
      appleMusicUrl:
        "https://music.apple.com/us/album/big-rushi-single/1891848018",
      youtubeUrl: "https://www.youtube.com/watch?v=0-IM_-UweA4",
      featuredVideoUrl: "https://www.youtube.com/watch?v=0-IM_-UweA4",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      title: "BIG RUSHI",
      slug: "dripstick-big-rushi",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b273b2fda15cbced407706b1cfc8",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b273b2fda15cbced407706b1cfc8",
      coverArtAltText: "BIG RUSHI single cover artwork",
      type: "nerdcore",
      releaseDate: new Date("2026-04-10T00:00:00.000Z"),
      publicDescription:
        "A Kurourushi-centered Jujutsu Kaisen diss record that turns adaptation, swarm imagery, and a Yuta matchup into a compact solo showcase.",
      inspirationContext:
        "Written from Kurourushi's perspective, BIG RUSHI frames the Sendai Colony fight as a direct Yuta diss and builds its punchlines around cursed tools, roaches, domains, and survival.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Aggressive", "Playful", "High-energy"]),
      themes: JSON.stringify([
        "Jujutsu Kaisen",
        "Kurourushi",
        "Sendai Colony",
        "Battle rap"
      ]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: "https://open.spotify.com/album/79sBY2hIBusrqxX2dwOVgc",
      appleMusicUrl:
        "https://music.apple.com/us/album/big-rushi-single/1891848018",
      youtubeUrl: "https://www.youtube.com/watch?v=0-IM_-UweA4",
      featuredVideoUrl: "https://www.youtube.com/watch?v=0-IM_-UweA4",
      updatedOn: now
    }
  });

  await prisma.release.upsert({
    where: {id: WORST_WAY_ID},
    create: {
      id: WORST_WAY_ID,
      title: "WORST WAY",
      slug: "dripstick-worst-way",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "Shofu",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b2732da5934bc6d70156cd54fe9b",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b2732da5934bc6d70156cd54fe9b",
      coverArtAltText: "WORST WAY featuring Shofu single cover artwork",
      type: "nerdcore",
      releaseDate: new Date("2026-05-29T00:00:00.000Z"),
      publicDescription:
        "Drip$tick and Shofu trade sharp, dismissive performances over a release built for direct impact.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore"]),
      moods: JSON.stringify(["Confident", "Aggressive"]),
      themes: JSON.stringify(["Competition", "Dismissal", "Status"]),
      listenerContexts: JSON.stringify([
        "Rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: "https://open.spotify.com/album/2pxniifCdKGVGMgh4hkFkY",
      appleMusicUrl:
        "https://music.apple.com/us/album/worst-way-feat-shofu-single/6772320917",
      youtubeUrl: "https://www.youtube.com/watch?v=k1q1WIPGwM8",
      featuredVideoUrl: "https://www.youtube.com/watch?v=k1q1WIPGwM8",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      title: "WORST WAY",
      slug: "dripstick-worst-way",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "Shofu",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b2732da5934bc6d70156cd54fe9b",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b2732da5934bc6d70156cd54fe9b",
      coverArtAltText: "WORST WAY featuring Shofu single cover artwork",
      type: "nerdcore",
      releaseDate: new Date("2026-05-29T00:00:00.000Z"),
      publicDescription:
        "Drip$tick and Shofu trade sharp, dismissive performances over a release built for direct impact.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore"]),
      moods: JSON.stringify(["Confident", "Aggressive"]),
      themes: JSON.stringify(["Competition", "Dismissal", "Status"]),
      listenerContexts: JSON.stringify([
        "Rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: "https://open.spotify.com/album/2pxniifCdKGVGMgh4hkFkY",
      appleMusicUrl:
        "https://music.apple.com/us/album/worst-way-feat-shofu-single/6772320917",
      youtubeUrl: "https://www.youtube.com/watch?v=k1q1WIPGwM8",
      featuredVideoUrl: "https://www.youtube.com/watch?v=k1q1WIPGwM8",
      updatedOn: now
    }
  });

  await prisma.release.update({
    where: {id: mahoraga.id},
    data: {
      collaborator: true,
      collaboratorName: "Drip$tick",
      releaseDate: new Date("2026-06-10T00:00:00.000Z"),
      coverArtUrl:
        mahoraga.coverArtUrl ||
        "https://i.scdn.co/image/ab67616d0000b2734f49b22e4404f39606b551f5",
      coverArtPath:
        mahoraga.coverArtPath ||
        "https://i.scdn.co/image/ab67616d0000b2734f49b22e4404f39606b551f5",
      coverArtAltText:
        "Mahoraga by vvviruz featuring Drip$tick cover artwork",
      lyrics: MAHORAGA_LYRICS,
      publicDescription:
        "An adaptive Jujutsu Kaisen rap built from Mahoraga's perspective, with vvviruz and Drip$tick turning the Divine General's wheel, evolving defenses, and reputation as a final test into a compact back-and-forth.",
      publicLongDescription: "",
      inspirationContext:
        "Mahoraga channels the perspective of the Ten Shadows Technique's strongest shikigami. vvviruz and Drip$tick build the track around its rotating wheel, ability to adapt, Shibuya confrontation, and role as a final test for Jujutsu Kaisen's strongest fighters.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Nerdcore", "Anime Rap"]),
      moods: JSON.stringify(["Aggressive", "Dark", "High-energy"]),
      themes: JSON.stringify([
        "Jujutsu Kaisen",
        "Mahoraga",
        "Adaptation",
        "Battle rap"
      ]),
      listenerContexts: JSON.stringify([
        "Anime rap playlists",
        "Workout",
        "High-energy listening"
      ]),
      spotifyUrl: "https://open.spotify.com/track/749ZiDfBjHXURCbD56YU8t",
      appleMusicUrl:
        "https://music.apple.com/us/song/mahoraga-jujutsu-kaisen-rap-feat-drip%24tick/6768088600",
      youtubeUrl: "https://www.youtube.com/watch?v=-29taZmFc50",
      featuredVideoUrl: "https://www.youtube.com/watch?v=-29taZmFc50",
      updatedOn: now
    }
  });

  await prisma.releaseArtistCredit.upsert({
    where: {
      releaseId_artistProfileId_role: {
        releaseId: mahoraga.id,
        artistProfileId: ARTIST_ID,
        role: "COLLABORATOR"
      }
    },
    create: {
      id: `credit-${mahoraga.id}-dripstick`,
      releaseId: mahoraga.id,
      artistProfileId: ARTIST_ID,
      role: "COLLABORATOR",
      displayOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    update: {displayOrder: 0, updatedAt: now}
  });

  await upsertEditorialAnnotations(mahoraga.id, MAHORAGA_LYRICS);

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "dripstick",
    displayName: "Drip$tick",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United States",
    locationCountryCode: "US",
    themeFamily: "violet-haze",
    longBio:
      "Drip$tick is a United States-based hip-hop artist and LOOP FX member building character-driven rap around anime, gaming, and internet culture. His catalog moves between antagonistic character perspectives, dense punchlines, and collaborative scene records, with the 2025 projects ALIEN and C B D $ W I B ? leading into an active run of Jujutsu Kaisen-inspired releases in 2026.",
    differentiator:
      "Character-first writing with an antagonist's edge: Drip$tick turns anime lore into punchlines, diss records, and scene-wide collaborations without losing a recognizable voice.",
    genres: ["Hip-Hop/Rap", "Nerdcore", "Anime Rap"],
    primaryCtaLabel: "Watch on YouTube",
    primaryCtaUrl: "https://www.youtube.com/@DripStick",
    secondaryCtaLabel: "Listen on Spotify",
    secondaryCtaUrl:
      "https://open.spotify.com/artist/6ZJvO3Bep601OM4V5bgm8q",
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "Illustrated close-up avatar of Drip$tick with violet star-filled eyes",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Who is Drip?",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Mahoraga",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from Drip$tick",
      platformLabel: "Find Drip$tick"
    },
    seoTitle: "Drip$tick | Artist Profile",
    seoDescription:
      "Explore Drip$tick, a United States-based hip-hop and nerdcore artist turning anime lore into character-driven records, punchlines, and collaborations.",
    socialImageUrl: PROFILE_IMAGE_URL,
    expansion: {
      catalogEnabled: false,
      catalogTitle: "Releases",
      catalogIntro: "",
      catalogCtaLabel: "View all releases",
      catalogReleaseIds: [mahoraga.id, BIG_RUSHI_ID, WORST_WAY_ID],
      editorialReleaseIds: [mahoraga.id],
      featuredStoriesEnabled: false,
      featuredStoriesLabel: "Featured stories",
      featuredStoriesHeading: "Go deeper"
    },
    links: profileLinks,
    featuredItems: [
      {
        releaseId: mahoraga.id,
        itemType: "collaboration",
        eyebrow: "Start Here",
        title: "Mahoraga",
        subtitle: "2026 · Jujutsu Kaisen Rap",
        description:
          "vvviruz and Drip$tick channel the Divine General's rotating wheel, adaptive force, and status as a final test.",
        url: "https://www.youtube.com/watch?v=-29taZmFc50",
        coverArtUrl:
          mahoraga.coverArtPath ||
          mahoraga.coverArtUrl ||
          "https://i.scdn.co/image/ab67616d0000b2734f49b22e4404f39606b551f5",
        coverArtAlt:
          "Mahoraga by vvviruz featuring Drip$tick cover artwork",
        isStartHere: true
      },
      {
        itemType: "single",
        eyebrow: "More from Drip$tick",
        title: "BIG RUSHI",
        subtitle: "2026 · Jujutsu Kaisen Rap",
        description:
          "A Kurourushi-centered Yuta diss and Drip$tick's strongest recent solo video.",
        url: "https://www.youtube.com/watch?v=0-IM_-UweA4",
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b273b2fda15cbced407706b1cfc8",
        coverArtAlt: "BIG RUSHI single cover artwork",
        isStartHere: false
      },
      {
        itemType: "collaboration",
        eyebrow: "More from Drip$tick",
        title: "WORST WAY",
        subtitle: "2026 · feat. Shofu",
        description:
          "A direct, high-impact collaboration from Drip$tick and Shofu.",
        url: "https://www.youtube.com/watch?v=k1q1WIPGwM8",
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b2732da5934bc6d70156cd54fe9b",
        coverArtAlt: "WORST WAY featuring Shofu single cover artwork",
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
        editorialPath: `/preview/artists/${preview.token}/music/${mahoraga.slug}`,
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
