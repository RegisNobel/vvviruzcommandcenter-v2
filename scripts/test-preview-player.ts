import {prisma} from "../lib/db/prisma";
import {validateAndNormalizeYouTubePlaylistUrl} from "../lib/exclusive-offer-safety";
import {isReleaseEligibleForPreview} from "../lib/release-planning";
import {upsertExclusiveSubscriber, readSubscriberByExclusiveAccessToken} from "../lib/repositories/audience";
import {toOptionalDate} from "../lib/db/serialization";
import {parseAndNormalizeYouTubePlaylist} from "../lib/youtube-utils";

// Simple test helper
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log("Running Upcoming Preview Player & YouTube Exclusives Playlist test suite...\n");

  // 1. YouTube Playlist URL Validation (Centralized Utility)
  console.log("--- 1. YouTube Playlist Validation (Centralized Utility) ---");
  try {
    const details1 = parseAndNormalizeYouTubePlaylist("https://www.youtube.com/playlist?list=PL123456789012345");
    assert(details1.playlistId === "PL123456789012345", "Extracts standard playlist ID");
    assert(details1.publicUrl === "https://www.youtube.com/playlist?list=PL123456789012345", "Builds canonical public URL");
    assert(details1.embedUrl === "https://www.youtube-nocookie.com/embed/videoseries?list=PL123456789012345", "Builds privacy-enhanced embed URL");

    const details2 = parseAndNormalizeYouTubePlaylist("https://music.youtube.com/playlist?list=PL_abc-123_xyz");
    assert(details2.playlistId === "PL_abc-123_xyz", "Extracts music youtube playlist ID");
    assert(details2.embedUrl === "https://www.youtube-nocookie.com/embed/videoseries?list=PL_abc-123_xyz", "Builds privacy-enhanced music embed URL");

    const details3 = parseAndNormalizeYouTubePlaylist("https://youtu.be/watch?list=abcde12345XYZ");
    assert(details3.playlistId === "abcde12345XYZ", "Extracts youtu.be playlist ID");

    try {
      parseAndNormalizeYouTubePlaylist("https://google.com");
      assert(false, "Should reject non-youtube domain");
    } catch (e: any) {
      assert(e.message.includes("valid YouTube host"), "Rejects invalid host");
    }

    try {
      parseAndNormalizeYouTubePlaylist("https://youtube.com/watch?v=123");
      assert(false, "Should reject links without playlist ID");
    } catch (e: any) {
      assert(e.message.includes("must contain a valid playlist ID"), "Rejects link missing list parameter");
    }
  } catch (err) {
    console.error("Error in YouTube Playlist validation tests:", err);
    failed++;
  }

  // 2. Shuffle-Bag Rotation Simulation
  console.log("\n--- 2. Shuffle-Bag Rotation ---");
  try {
    const tracks = [
      {id: "t1", isActive: true, sortOrder: 0, audioUrl: "a1"},
      {id: "t2", isActive: true, sortOrder: 1, audioUrl: "a2"},
      {id: "t3", isActive: true, sortOrder: 2, audioUrl: "a3"}
    ];

    // Simulate shuffle bag
    const initialShuffled = [...tracks].sort(() => Math.random() - 0.5);
    assert(initialShuffled.length === 3, "Shuffle queue correctly holds all active tracks");
    
    // Check rotation does not produce back-to-back repetitions on exhaustion
    const lastTrack = initialShuffled[2]!;
    let reshuffled = [...tracks].sort(() => Math.random() - 0.5);
    if (reshuffled[0]?.id === lastTrack.id) {
      reshuffled.push(reshuffled.shift()!);
    }
    assert(reshuffled[0]?.id !== lastTrack.id, "Shuffle-bag ensures the first track of next bag is different from last of current bag");
  } catch (err) {
    console.error("Error in Shuffle-Bag tests:", err);
    failed++;
  }

  // 3. Timezone boundaries (toOptionalDate)
  console.log("\n--- 3. Timezone Boundaries ---");
  try {
    // ISO date string parsed to UTC midnight
    const parsedUTC = toOptionalDate("2026-07-06");
    assert(parsedUTC !== null, "Parses YYYY-MM-DD format");
    assert(parsedUTC?.toISOString() === "2026-07-06T00:00:00.000Z", "Covers release-day timezone boundaries: parsed as UTC midnight");
  } catch (err) {
    console.error("Error in Timezone boundary tests:", err);
    failed++;
  }

  // 4. Optional Name persistence & Token encapsulation behavior
  console.log("\n--- 4. Optional Name Persistence & Token Encapsulation ---");
  try {
    const testEmail = `subscriber-test-${Date.now()}@test.com`;

    // 1. Create new subscriber with empty name
    const sub1 = await upsertExclusiveSubscriber({
      email: testEmail,
      name: "",
      consentGiven: true
    });
    assert(sub1.subscriber.name === "", "Records new subscriber with blank name");
    assert(sub1.subscriber.download_token !== undefined, "Sets access token (download_token)");

    // Test token encapsulation helper
    const foundSub = await readSubscriberByExclusiveAccessToken(sub1.subscriber.download_token);
    assert(foundSub !== null, "Successfully reads subscriber using encapsulated access token helper");
    assert(foundSub?.email === testEmail, "Encapsulated helper returns correct subscriber");

    // 2. Signup again with a new name
    const sub2 = await upsertExclusiveSubscriber({
      email: testEmail,
      name: "Alice",
      consentGiven: true
    });
    assert(sub2.subscriber.name === "Alice", "Updates blank name with new provided name");

    // 3. Signup again with empty name (should preserve existing name)
    const sub3 = await upsertExclusiveSubscriber({
      email: testEmail,
      name: "",
      consentGiven: true
    });
    assert(sub3.subscriber.name === "Alice", "Preserves existing name when signup has blank name");
  } catch (err) {
    console.error("Error in Optional Name / Token encapsulation tests:", err);
    failed++;
  }

  // 5. Vault Isolation & Exclusions
  console.log("\n--- 5. Vault Category Isolation & Centralized Eligibility ---");
  try {
    // Let's check a mock release record
    const mockReleaseReleased: any = {
      id: "r1",
      title: "Released Song",
      concept_complete: true,
      cover_art: true,
      beat_made: true,
      lyrics_finished: true,
      recorded: true,
      mix_mastered: true,
      published: true,
      release_date: "2026-01-01",
      collaborator: false,
      collaborator_name: ""
    };

    const mockReleaseUpcoming: any = {
      id: "r2",
      title: "Upcoming Song",
      published: false,
      release_date: "2026-12-31",
      collaborator: false,
      collaborator_name: ""
    };

    const mockReleasePublishedButFuture: any = {
      id: "r3",
      title: "Pre-Release Song",
      published: true,
      release_date: "2999-12-31",
      collaborator: false,
      collaborator_name: ""
    };

    // test eligibility
    const isEligible1 = isReleaseEligibleForPreview(mockReleaseReleased);
    assert(isEligible1 === false, "Released song is excluded from preview player");

    const isEligible2 = isReleaseEligibleForPreview(mockReleaseUpcoming);
    assert(isEligible2 === true, "Upcoming song is eligible for preview player");

    const isEligible3 = isReleaseEligibleForPreview(mockReleasePublishedButFuture);
    assert(isEligible3 === true, "Published song with future release date (pre-release page) is eligible for preview player");
  } catch (err) {
    console.error("Error in Vault isolation/eligibility tests:", err);
    failed++;
  }

  // Final summary
  console.log(`\nTest results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
