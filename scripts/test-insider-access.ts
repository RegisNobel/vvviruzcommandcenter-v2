import {extractYouTubeVideoId, getCanonicalYouTubeWatchUrl} from "../lib/youtube-utils";
import {
  validateAndNormalizePrivateExternalUrl,
  validateExclusiveEmailDeliverySettings,
  normalizeExclusiveDeliverySettings
} from "../lib/exclusive-offer-safety";

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
    process.exit(1);
  }
}

console.log("Starting unit tests for Insider Access refactoring...\n");

runTest("extractYouTubeVideoId - standard watch url", () => {
  const id = extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  if (id !== "dQw4w9WgXcQ") throw new Error(`Expected dQw4w9WgXcQ, got ${id}`);
});

runTest("extractYouTubeVideoId - music watch url", () => {
  const id = extractYouTubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
  if (id !== "dQw4w9WgXcQ") throw new Error(`Expected dQw4w9WgXcQ, got ${id}`);
});

runTest("extractYouTubeVideoId - mobile watch url", () => {
  const id = extractYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
  if (id !== "dQw4w9WgXcQ") throw new Error(`Expected dQw4w9WgXcQ, got ${id}`);
});

runTest("extractYouTubeVideoId - youtu.be short url", () => {
  const id = extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ");
  if (id !== "dQw4w9WgXcQ") throw new Error(`Expected dQw4w9WgXcQ, got ${id}`);
});

runTest("extractYouTubeVideoId - url with watch and list params", () => {
  const id = extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL12345");
  if (id !== "dQw4w9WgXcQ") throw new Error(`Expected dQw4w9WgXcQ, got ${id}`);
});

runTest("extractYouTubeVideoId - playlist-only url throws error", () => {
  try {
    extractYouTubeVideoId("https://www.youtube.com/playlist?list=PL12345");
    throw new Error("Should have thrown for playlist-only URL");
  } catch (err: any) {
    if (err.message.includes("valid 11-character video ID")) {
      // success
    } else {
      throw err;
    }
  }
});

runTest("extractYouTubeVideoId - non-youtube domain throws error", () => {
  try {
    extractYouTubeVideoId("https://google.com/watch?v=dQw4w9WgXcQ");
    throw new Error("Should have thrown for non-youtube host");
  } catch (err: any) {
    if (err.message.includes("valid YouTube host")) {
      // success
    } else {
      throw err;
    }
  }
});

runTest("validateAndNormalizePrivateExternalUrl - YouTube", () => {
  const norm = validateAndNormalizePrivateExternalUrl("https://youtu.be/dQw4w9WgXcQ");
  if (norm !== "https://www.youtube.com/watch?v=dQw4w9WgXcQ") {
    throw new Error(`Expected canonical URL, got ${norm}`);
  }
});

runTest("validateAndNormalizePrivateExternalUrl - SoundCloud", () => {
  const norm = validateAndNormalizePrivateExternalUrl("https://soundcloud.com/artist/track");
  if (norm !== "https://soundcloud.com/artist/track") {
    throw new Error(`Expected unchanged SoundCloud URL, got ${norm}`);
  }
});

runTest("validateAndNormalizePrivateExternalUrl - BandLab", () => {
  const norm = validateAndNormalizePrivateExternalUrl("https://www.bandlab.com/post/123456");
  if (norm !== "https://www.bandlab.com/post/123456") {
    throw new Error(`Expected unchanged BandLab URL, got ${norm}`);
  }
});

runTest("validateAndNormalizePrivateExternalUrl - invalid URL throws error", () => {
  try {
    validateAndNormalizePrivateExternalUrl("invalid-url-string");
    throw new Error("Should have thrown for invalid URL");
  } catch (err: any) {
    if (err.message.includes("valid URL")) {
      // success
    } else {
      throw err;
    }
  }
});

runTest("normalizeExclusiveDeliverySettings - trims and nullifies release_id", () => {
  const mockSettings = {
    badge_text: "Insider",
    headline: "Test",
    subtext: "Test subtext",
    brand_line: "",
    cta_label: "Join",
    name_label: "Name",
    email_label: "Email",
    consent_label: "Consent",
    success_heading: "Success",
    success_message: "You are in",
    duplicate_message: "Duplicate",
    download_label: "",
    unavailable_heading: "",
    unavailable_body: "",
    exclusive_track_title: "Title",
    exclusive_track_description: "Desc",
    exclusive_track_file_path: "",
    exclusive_track_art_path: "",
    exclusive_track_enabled: true,
    release_id: "  release-123  ", // to be trimmed
    unlock_experience: "instant_unlock" as const,
    private_external_url: "https://youtu.be/dQw4w9WgXcQ",
    instant_unlock_button_label: "Watch",
    also_email_link: true,
    email_subject: "Subject",
    email_body: "Body",
    discord_invite_url: "",
    community_badge_text: "",
    community_headline: "",
    community_subheadline: "",
    community_microcopy: "",
    community_cta_heading: "",
    community_cta_label: "",
    community_cta_helper: "",
    community_benefits: []
  };

  const norm = normalizeExclusiveDeliverySettings(mockSettings);
  if (norm.release_id !== "release-123") {
    throw new Error(`Expected trimmed release_id, got '${norm.release_id}'`);
  }

  mockSettings.release_id = "   "; // empty string
  const norm2 = normalizeExclusiveDeliverySettings(mockSettings);
  if (norm2.release_id !== null) {
    throw new Error(`Expected null release_id, got '${norm2.release_id}'`);
  }
});

console.log("\nAll unit tests passed successfully!");
process.exit(0);
