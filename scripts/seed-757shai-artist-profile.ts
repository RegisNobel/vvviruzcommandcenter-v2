import {prisma} from "../lib/db/prisma";
import {parseCanonicalLyrics} from "../lib/lyrics";
import {
  createArtistPreviewVersion,
  saveArtistProfile
} from "../lib/repositories/artist-profiles";
import {createReleaseAnnotationAnchor} from "../lib/server/release-annotation-anchors";

const ARTIST_ID = "artist-profile-757shai";
const MISTAKES_ID = "artist-release-757shai-mistakes";
const BROKEN_PIECES_ID = "artist-release-757shai-broken-pieces";
const PROFILE_IMAGE_URL =
  "https://i.scdn.co/image/ab6761610000e5eb45c370529c678dbe5a6d7238";

const GAME_OVER_LYRICS = `[Chorus 1]
Game over, Game over
I’ll never stop - Until it’s game over

[Verse 1]
1, 2
1, 2, 3 — two more and I’m going on a rampage
Glitching and breaking the game - Call me a vandal and spare me the “savage”
I’m not talking DC — I DC’d But don’t think you’ve won, ’cause I come back I get to cooking
Look at the KD - im Switching to carry, I’m done with supporting//

vvviruz again… no luck today - Tomorrow, I’m trying again
I’m deep in the mud - That’s what you get when you fervently ask for the rain
Again and again - Again and again and again
To hell with the pain - I’m up and I’m sliding again Because life is a game//

My back - is made of the barz that I spit - So I carry
Don’t matter the place Give me a mic and I make it a party
Speed running the session - I got the force — they think that I’m Wally (West)
Haters are down for the countBut I’m hitting the gas
And I’m upping the tally//

[Chorus 1]

[Verse 2: 757Shai]
Game over - Water on me, make it rain hoe
Sippin henny like Weezy and Dej Loaf
With my brodie, he sippin on Saints Row
Wanna talk on my name, it get fatal
Carry static that fuck up ya cable
Blueberry za going mixed with the Faygo
My shawty say she finna do what i say so
Doja, i'm leavin her spread on the table//

Who wanna talk? They don't know who i am
Used to tell me i couldn't - I showed em i can
Y'all isn't shooting, y'all nothing but fans
I ain't finna leave till there's blood on my hands
I ain't finna dip, i ain't finna scram
I ain't finna act like it's part of the plan
I'm taking a trip - Let's go to Japan
And by the end i'll still be swimming in bands//

Shit get worse everytime i get older
Tracks heat up but my heart get colder
Fuck that bitch, i don't care what i told her
Dimes, my fist, shit look like a boulder
.556 came black and golden
Quick drive-by, clique chip your shoulder
Switch that shit, think the kid bipolar
Hits, no miss, lil bitch, game over//

[Chorus 2]
Game over, Game over
I’ll never stop - Until it’s game over
you’re mistaken If you were thinking that I’ma lose
I’m ’bout to lock in Now I’m aware of your every move
Game over, Game over - I’ll never stop - Until it’s game over
Game over, Game over
I’ll never stop - Until it’s game over`;

const profileLinks = [
  {
    platform: "spotify",
    label: "Spotify",
    url: "https://open.spotify.com/artist/0Uq70smsL1bKEttmKnXF55",
    isPrimary: true
  },
  {
    platform: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/@757shai"
  },
  {
    platform: "apple_music",
    label: "Apple Music",
    url: "https://music.apple.com/us/artist/757shai/1592301021"
  },
  {
    platform: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/757shai/"
  },
  {
    platform: "tiktok",
    label: "TikTok",
    url: "https://www.tiktok.com/@757shai"
  },
  {
    platform: "x",
    label: "X / Twitter",
    url: "https://x.com/757shai"
  },
  {
    platform: "soundcloud",
    label: "SoundCloud",
    url: "https://soundcloud.com/757shai"
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

async function upsertGameOverAnnotations(releaseId: string) {
  const now = new Date();
  const annotations = [
    {
      id: "7ce5c7c7-66eb-4f05-a378-08f1f4fbee8e",
      type: "game_reference",
      excerptLines: [
        "1, 2",
        "1, 2, 3 — two more and I’m going on a rampage"
      ],
      title: "Breaking Barz: Game Over Breakdown 1",
      summary:
        "The count begins as a half-bar pickup before restarting as a complete line. “Two more” brings the count to five, referencing a Dota 2 Rampage, earned by eliminating all five enemy heroes.",
      explanation:
        "The opening “1, 2” is delivered as a short half-bar pickup. The count then restarts with “1, 2, 3” as the full bar begins, using repetition to build momentum in a trap-style flow.\n\nThe phrase “two more” continues the count from three to five. In Dota 2, a Rampage is announced when one player kills all five members of the opposing team within a short period. The bar therefore counts toward the five eliminations needed to go on a Rampage."
    },
    {
      id: "358e4b1a-0c7e-4352-8784-48d797a27441",
      type: "double_meaning",
      excerptLines: [
        "Glitching and breaking the game - Call me a vandal and spare me the “savage”",
        "I’m not talking DC — I DC’d But don’t think you’ve won, ’cause I come back I get to cooking",
        "Look at the KD - im Switching to carry, I’m done with supporting//"
      ],
      title: "Breaking Barz: Game Over Breakdown 2",
      summary:
        "vvviruz describes intentionally breaking the game like a vandal, then flips “vandal” and “savage” into a DC Comics reference. Even after disconnecting, he returns ready to carry the team, with his K/D proving he can lead them to victory.",
      explanation:
        "“Glitching and breaking the game” presents vvviruz as someone disrupting the system instead of following its intended rules. Calling himself a vandal reinforces the image of deliberately damaging or altering something, while “spare me the savage” clarifies that the destruction is calculated rather than mindless.\n\nTogether, “vandal” and “savage” also reference Vandal Savage, the immortal DC Comics villain.\n\nThe next line continues the DC wordplay with “I’m not talking DC, I DC’d.” Here, “DC” first refers to DC Comics, then becomes gaming shorthand for disconnected. Although disconnecting could give the opposing team an advantage, vvviruz warns them not to celebrate because he will return stronger and immediately “get to cooking.”\n\n“Look at the K/D” points to his kill-to-death ratio as evidence of his performance. Based on those stats, he switches from a supporting role to the carry, taking responsibility for leading the team to victory."
    },
    {
      id: "8290df60-7d63-4a5c-9436-db33c30b8781",
      type: "double_meaning",
      excerptLines: [
        "vvviruz again… no luck today - Tomorrow, I’m trying again",
        "I’m deep in the mud - That’s what you get when you fervently ask for the rain",
        "Again and again - Again and again and again",
        "To hell with the pain - I’m up and I’m sliding again Because life is a game//"
      ],
      title: "Breaking Barz: Game Over Breakdown 3",
      summary:
        "vvviruz keeps returning despite failure. Rain represents the success he asked for, while the mud represents the difficult work that comes with it. Life becomes a game where pain is endured and every loss leads to another attempt.",
      explanation:
        "“vvviruz again” emphasizes consistency and persistence. Even when luck is not on his side today, he plans to return tomorrow and try again rather than accepting defeat.\n\nThe rain represents the success, growth, and opportunities he has passionately asked for. However, rain also creates mud, which symbolizes the difficult work, setbacks, and uncomfortable conditions required to reach that success. He cannot ask for the reward without accepting the struggle that comes with it.\n\nThe repeated use of “again” recreates the cycle of gaming. The player fails, restarts, learns, and makes another attempt. “To hell with the pain” shows his decision to keep moving regardless of how many times the process hurts.\n\nBy ending with “Because life is a game,” vvviruz connects gaming persistence to real life. Failure is not the ending. It is another attempt, and he will keep playing until he gets the result he is chasing."
    },
    {
      id: "5ad8c04e-434a-4c9b-9ce4-278961caaa20",
      type: "double_meaning",
      excerptLines: [
        "My back - is made of the barz that I spit - So I carry",
        "Don’t matter the place Give me a mic and I make it a party",
        "Speed running the session - I got the force — they think that I’m Wally (West)",
        "Haters are down for the countBut I’m hitting the gas",
        "And I’m upping the tally//"
      ],
      title: "Breaking Barz: Game Over Breakdown 4",
      summary:
        "Rap bars become iron bars that strengthen vvviruz’s back, allowing him to carry both the song and the team. He then speed-runs the session like Wally West before continuing to increase the score, even after his opponents are already down.",
      explanation:
        "“My back is made of the barz that I spit” turns rap bars into physical bars of iron. The more vvviruz writes, records, and perfects his craft, the stronger his back becomes. That strength allows him to “carry,” meaning both carrying the weight created by his hard work and taking the lead as the team’s carry in a game.\n\n“Don’t matter the place, give me a mic and I make it a party” shows his confidence as a performer. Regardless of the environment, he can take control of the energy and turn any setting into an event.\n\n“Speed running the session” compares his fast and efficient recording process to a gaming speedrun, where a player completes a game or objective as quickly as possible.\n\n“I got the force, they think that I’m Wally” references Wally West, one of DC Comics’ fastest speedsters and a user of the Speed Force. The line connects his speed in the session to Wally’s superhuman speed.\n\nIn the final lines, the haters are already “down for the count,” suggesting that they have been defeated. However, vvviruz does not slow down or ease off the gas. He continues building momentum and “upping the tally,” adding more wins and accomplishments even when the outcome already appears decided."
    }
  ];

  for (const [sortOrder, annotation] of annotations.entries()) {
    const anchor = findAnnotationAnchor(
      GAME_OVER_LYRICS,
      annotation.excerptLines
    );
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
        confidence: "official_context",
        isPublic: true,
        sortOrder,
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now
      },
      update: {
        releaseId,
        type: annotation.type,
        lyricExcerpt: anchor.excerptSnapshot,
        ...anchor,
        title: annotation.title,
        summary: annotation.summary,
        explanation: annotation.explanation,
        status: "ready",
        confidence: "official_context",
        isPublic: true,
        sortOrder,
        lastReviewedAt: now,
        updatedAt: now
      }
    });
  }
}

async function upsertSupportingReleases(now: Date) {
  await prisma.release.upsert({
    where: {id: MISTAKES_ID},
    create: {
      id: MISTAKES_ID,
      title: "mistakes",
      slug: "757shai-mistakes",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "Sh!nki",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b2731c6b9dec3cc9d1eea0450147",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b2731c6b9dec3cc9d1eea0450147",
      coverArtAltText: "mistakes by 757shai featuring Sh!nki cover artwork",
      type: "single",
      releaseDate: new Date("2025-05-24T00:00:00.000Z"),
      publicDescription:
        "A bruised, high-intensity collaboration with Sh!nki about regret, isolation, and trying to repair the damage.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Rock", "Hip-Hop/Rap", "Melodic Rap"]),
      moods: JSON.stringify(["Emotional", "Dark", "Defiant"]),
      themes: JSON.stringify(["Regret", "Isolation", "Recovery"]),
      listenerContexts: JSON.stringify([
        "Late-night listening",
        "Emotional release",
        "Alternative rap playlists"
      ]),
      spotifyUrl:
        "https://open.spotify.com/track/6vEDotB8iwdxjePu7ffICq",
      appleMusicUrl:
        "https://music.apple.com/us/album/mistakes-feat-sh-nki-single/1815232125",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      title: "mistakes",
      slug: "757shai-mistakes",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "Sh!nki",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b2731c6b9dec3cc9d1eea0450147",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b2731c6b9dec3cc9d1eea0450147",
      coverArtAltText: "mistakes by 757shai featuring Sh!nki cover artwork",
      type: "single",
      releaseDate: new Date("2025-05-24T00:00:00.000Z"),
      publicDescription:
        "A bruised, high-intensity collaboration with Sh!nki about regret, isolation, and trying to repair the damage.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Rock", "Hip-Hop/Rap", "Melodic Rap"]),
      moods: JSON.stringify(["Emotional", "Dark", "Defiant"]),
      themes: JSON.stringify(["Regret", "Isolation", "Recovery"]),
      listenerContexts: JSON.stringify([
        "Late-night listening",
        "Emotional release",
        "Alternative rap playlists"
      ]),
      spotifyUrl:
        "https://open.spotify.com/track/6vEDotB8iwdxjePu7ffICq",
      appleMusicUrl:
        "https://music.apple.com/us/album/mistakes-feat-sh-nki-single/1815232125",
      updatedOn: now
    }
  });

  await prisma.release.upsert({
    where: {id: BROKEN_PIECES_ID},
    create: {
      id: BROKEN_PIECES_ID,
      title: "broken pieces",
      slug: "757shai-broken-pieces",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "Young Light",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b273704cec93b208b16f0134b42d",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b273704cec93b208b16f0134b42d",
      coverArtAltText:
        "broken pieces by 757shai and Young Light cover artwork",
      type: "single",
      releaseDate: new Date("2024-11-02T00:00:00.000Z"),
      publicDescription:
        "757shai and Young Light turn emotional fracture into a melodic, cathartic collaboration.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Melodic Rap"]),
      moods: JSON.stringify(["Emotional", "Melancholic", "Cathartic"]),
      themes: JSON.stringify(["Heartbreak", "Loss", "Emotional recovery"]),
      listenerContexts: JSON.stringify([
        "Late-night listening",
        "Heartbreak playlists",
        "Reflective listening"
      ]),
      spotifyUrl:
        "https://open.spotify.com/track/0Iw7i4BcVjmAkeihTiOoFL",
      isPublished: false,
      createdOn: now,
      updatedOn: now
    },
    update: {
      title: "broken pieces",
      slug: "757shai-broken-pieces",
      catalogScope: "ARTIST",
      primaryArtistProfileId: ARTIST_ID,
      collaborator: true,
      collaboratorName: "Young Light",
      coverArtUrl:
        "https://i.scdn.co/image/ab67616d0000b273704cec93b208b16f0134b42d",
      coverArtPath:
        "https://i.scdn.co/image/ab67616d0000b273704cec93b208b16f0134b42d",
      coverArtAltText:
        "broken pieces by 757shai and Young Light cover artwork",
      type: "single",
      releaseDate: new Date("2024-11-02T00:00:00.000Z"),
      publicDescription:
        "757shai and Young Light turn emotional fracture into a melodic, cathartic collaboration.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify(["Hip-Hop/Rap", "Melodic Rap"]),
      moods: JSON.stringify(["Emotional", "Melancholic", "Cathartic"]),
      themes: JSON.stringify(["Heartbreak", "Loss", "Emotional recovery"]),
      listenerContexts: JSON.stringify([
        "Late-night listening",
        "Heartbreak playlists",
        "Reflective listening"
      ]),
      spotifyUrl:
        "https://open.spotify.com/track/0Iw7i4BcVjmAkeihTiOoFL",
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
  const gameOver = await prisma.release.findUnique({
    where: {slug: "game-over"},
    select: {id: true, slug: true}
  });

  if (!gameOver) {
    throw new Error(
      "Game Over must exist in the vvviruz catalog before creating 757shai's preview."
    );
  }

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "757shai",
    displayName: "757shai",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United Kingdom",
    locationCountryCode: "GB",
    themeFamily: "ocean-depth",
    longBio:
      "757shai is a United Kingdom-based songwriter, rapper, and engineer making emotionally direct, genre-fluid music across hip-hop, pop, rock, and nerdcore. His catalog moves between personal records about isolation, loss, resilience, and self-reconstruction and fandom-driven tracks shaped by anime, films, television, and games. Working within the 786HAVOX and DOWNHILL orbit, he pairs melodic hooks with sharp rap writing and frequent collaborations.",
    differentiator:
      "757shai moves between vulnerable melodic writing and high-energy fandom rap without treating them as separate identities; both sides rely on direct emotion, memorable hooks, and collaborative chemistry.",
    genres: ["Hip-Hop/Rap", "Melodic Rap", "Rock", "Nerdcore"],
    primaryCtaLabel: "Listen on Spotify",
    primaryCtaUrl:
      "https://open.spotify.com/artist/0Uq70smsL1bKEttmKnXF55",
    secondaryCtaLabel: "Watch on YouTube",
    secondaryCtaUrl: "https://www.youtube.com/@757shai",
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "757shai seated in silhouette against a clear blue sky",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Who is 757shai?",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Game Over",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from 757shai",
      platformLabel: "Find 757shai"
    },
    seoTitle: "757shai | Artist Profile",
    seoDescription:
      "Explore 757shai, a United Kingdom-based songwriter and rapper moving between emotionally direct melodic music and high-energy nerdcore.",
    socialImageUrl: PROFILE_IMAGE_URL,
    links: profileLinks,
    featuredItems: [],
    featuredStories: []
  });

  await upsertSupportingReleases(now);

  await prisma.release.update({
    where: {id: gameOver.id},
    data: {
      collaborator: true,
      collaboratorName: "757shai",
      coverArtUrl:
        "https://der42gjtvxvutavf.public.blob.vercel-storage.com/vvviruz/cover/6fcdc608-8b50-40b8-bc03-fa0ce0ce929c.jpg",
      coverArtPath:
        "https://der42gjtvxvutavf.public.blob.vercel-storage.com/vvviruz/cover/6fcdc608-8b50-40b8-bc03-fa0ce0ce929c.jpg",
      coverArtAltText:
        'Glitch-inspired black and gold album cover featuring large distorted "GAME OVER" text surrounded by a futuristic game interface, with vvviruz feat. 757shai displayed beneath.',
      lyrics: GAME_OVER_LYRICS,
      releaseDate: new Date("2026-07-22T00:00:00.000Z"),
      conceptDetails:
        "“Game Over” is a high-energy nerdcore track about resilience, repetition, and refusing to lose. Blending gaming metaphors with real-life struggle, vvviruz taps into the loop of failure, respawn, and comeback - proving that it’s never over until you decide it is.",
      publicDescription:
        '"Game Over" is a high-energy nerdcore anthem about resilience, repetition, and refusing to lose. Blending gaming and anime references with real-life struggle, vvviruz and 757shai capture the endless cycle of failure, respawn, and comeback, proving it\'s never over until you decide it is.',
      publicLongDescription:
        "Every gamer knows the feeling. You lose. You respawn. You try again.\n\nGame Over takes that cycle and turns it into a metaphor for life. Built around competitive gaming references, anime-inspired lyricism, and relentless energy, the song explores what it means to keep pushing after setbacks.\n\nFrom glitching through the game to speed-running sessions and carrying the team, every bar reflects the mindset of refusing to stay down. Failure isn't the ending. It's another attempt.\n\nFeaturing 757shai, Game Over blends aggressive flows, clever gaming wordplay, and motivational themes into an anthem for anyone chasing a goal that refuses to come easy.\n\nBecause life is a game... and the only real game over is giving up.",
      languages: JSON.stringify(["English"]),
      genres: JSON.stringify([
        "Nerdcore, Hip-Hop, Rap, Gaming Rap, Anime Rap"
      ]),
      moods: JSON.stringify([
        "Energetic, motivational, competitive, defiant, cinematic"
      ]),
      inspirationContext:
        "Inspired by the gaming worlds and progression-focused storytelling of Sword Art Online, Shangri-La Frontier, and Solo Leveling. “Game Over” uses concepts such as respawning, carrying a team, K/D ratios, speed-running, disconnecting, and replaying after defeat as metaphors for real-life resilience. The song centers on refusing to quit, learning from losses, and continuing to play until you win.",
      themes: JSON.stringify([
        "Resilience, perseverance, gaming, failure and retrying, self-improvement, refusing to quit"
      ]),
      listenerContexts: JSON.stringify([
        "Gaming sessions, workout playlists, training sessions, anime fans, comeback moments, motivation"
      ]),
      spotifyUrl:
        "https://open.spotify.com/track/6FwhnxGqQfF5Ofsinfa4GO?si=921565b02d5e4c40",
      appleMusicUrl:
        "https://music.apple.com/us/album/game-over-single/6784972256",
      youtubeUrl:
        "https://music.youtube.com/watch?v=C6oHYLK5sTI&si=NvUXZ-w9eNqhgHpz",
      featuredVideoUrl: "https://youtu.be/MVfQRus2kNA",
      publicLyricsEnabled: true,
      updatedOn: now
    }
  });

  await prisma.releaseArtistCredit.upsert({
    where: {
      releaseId_artistProfileId_role: {
        releaseId: gameOver.id,
        artistProfileId: ARTIST_ID,
        role: "COLLABORATOR"
      }
    },
    create: {
      id: `credit-${gameOver.id}-757shai`,
      releaseId: gameOver.id,
      artistProfileId: ARTIST_ID,
      role: "COLLABORATOR",
      displayOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    update: {displayOrder: 0, updatedAt: now}
  });

  await upsertGameOverAnnotations(gameOver.id);

  await saveArtistProfile({
    id: ARTIST_ID,
    slug: "757shai",
    displayName: "757shai",
    privateContactEmail: existingProfile?.privateContactEmail || "",
    location: "United Kingdom",
    locationCountryCode: "GB",
    themeFamily: "ocean-depth",
    longBio:
      "757shai is a United Kingdom-based songwriter, rapper, and engineer making emotionally direct, genre-fluid music across hip-hop, pop, rock, and nerdcore. His catalog moves between personal records about isolation, loss, resilience, and self-reconstruction and fandom-driven tracks shaped by anime, films, television, and games. Working within the 786HAVOX and DOWNHILL orbit, he pairs melodic hooks with sharp rap writing and frequent collaborations.",
    differentiator:
      "757shai moves between vulnerable melodic writing and high-energy fandom rap without treating them as separate identities; both sides rely on direct emotion, memorable hooks, and collaborative chemistry.",
    genres: ["Hip-Hop/Rap", "Melodic Rap", "Rock", "Nerdcore"],
    primaryCtaLabel: "Listen on Spotify",
    primaryCtaUrl:
      "https://open.spotify.com/artist/0Uq70smsL1bKEttmKnXF55",
    secondaryCtaLabel: "Watch on YouTube",
    secondaryCtaUrl: "https://www.youtube.com/@757shai",
    profileImagePath: PROFILE_IMAGE_URL,
    profileImageAlt:
      "757shai seated in silhouette against a clear blue sky",
    pageCopy: {
      signalLabel: "Signal",
      heroEyebrow: "Managed artist profile",
      storyLabel: "01 / Artist notes",
      storyHeading: "Who is 757shai?",
      fingerprintLabel: "Creative fingerprint",
      featuredButtonLabel: "Explore Game Over",
      selectedLabel: "02 / Selected releases",
      selectedHeading: "More from 757shai",
      platformLabel: "Find 757shai"
    },
    seoTitle: "757shai | Artist Profile",
    seoDescription:
      "Explore 757shai, a United Kingdom-based songwriter and rapper moving between emotionally direct melodic music and high-energy nerdcore.",
    socialImageUrl: PROFILE_IMAGE_URL,
    expansion: {
      catalogEnabled: false,
      catalogTitle: "Releases",
      catalogIntro: "",
      catalogCtaLabel: "View all releases",
      catalogReleaseIds: [gameOver.id, MISTAKES_ID, BROKEN_PIECES_ID],
      editorialReleaseIds: [gameOver.id],
      featuredStoriesEnabled: false,
      featuredStoriesLabel: "Featured stories",
      featuredStoriesHeading: "Go deeper"
    },
    links: profileLinks,
    featuredItems: [
      {
        releaseId: gameOver.id,
        itemType: "collaboration",
        eyebrow: "Start Here",
        title: "Game Over",
        subtitle: "2026 · vvviruz × 757shai",
        description:
          "A high-energy nerdcore anthem that turns failure, respawning, and replaying into a refusal to quit.",
        url: "https://open.spotify.com/track/6FwhnxGqQfF5Ofsinfa4GO",
        coverArtUrl:
          "https://der42gjtvxvutavf.public.blob.vercel-storage.com/vvviruz/cover/6fcdc608-8b50-40b8-bc03-fa0ce0ce929c.jpg",
        coverArtAlt:
          "Game Over by vvviruz and 757shai cover artwork",
        isStartHere: true
      },
      {
        itemType: "collaboration",
        eyebrow: "More from 757shai",
        title: "mistakes",
        subtitle: "2025 · feat. Sh!nki",
        description:
          "A bruised, high-intensity record about regret, isolation, and repairing the damage.",
        url: "https://open.spotify.com/track/6vEDotB8iwdxjePu7ffICq",
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b2731c6b9dec3cc9d1eea0450147",
        coverArtAlt:
          "mistakes by 757shai featuring Sh!nki cover artwork",
        isStartHere: false
      },
      {
        itemType: "collaboration",
        eyebrow: "More from 757shai",
        title: "broken pieces",
        subtitle: "2024 · with Young Light",
        description:
          "A melodic, cathartic collaboration built around emotional fracture and recovery.",
        url: "https://open.spotify.com/track/0Iw7i4BcVjmAkeihTiOoFL",
        coverArtUrl:
          "https://i.scdn.co/image/ab67616d0000b273704cec93b208b16f0134b42d",
        coverArtAlt:
          "broken pieces by 757shai and Young Light cover artwork",
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
        editorialPath: `/preview/artists/${preview.token}/music/${gameOver.slug}`,
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
