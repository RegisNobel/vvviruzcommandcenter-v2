import assert from "node:assert/strict";

import {
  buildYouTubePlaylistContextUrl,
  parseYouTubePlaylistUrl,
  parseYouTubeVideoUrl
} from "../lib/youtube-links";

const playlistUrl = "https://youtube.com/playlist?list=PLMc9tmqehTSpEjZ06UyfIkflsgnADZfdK&si=wykvXRAfrMUMj87m";
const videoUrl = "https://youtu.be/0cK5OAHjgws?si=U-3XU_-curigqPVu";

assert.deepEqual(parseYouTubeVideoUrl(videoUrl), {videoId: "0cK5OAHjgws"});
assert.deepEqual(parseYouTubePlaylistUrl(playlistUrl), {
  playlistId: "PLMc9tmqehTSpEjZ06UyfIkflsgnADZfdK"
});
assert.equal(
  buildYouTubePlaylistContextUrl(videoUrl, playlistUrl).targetUrl,
  "https://www.youtube.com/watch?v=0cK5OAHjgws&list=PLMc9tmqehTSpEjZ06UyfIkflsgnADZfdK"
);
assert.equal(
  buildYouTubePlaylistContextUrl(
    "https://www.youtube.com/watch?v=0cK5OAHjgws&list=OLD_PLAYLIST",
    playlistUrl
  ).targetUrl,
  "https://www.youtube.com/watch?v=0cK5OAHjgws&list=PLMc9tmqehTSpEjZ06UyfIkflsgnADZfdK"
);

assert.throws(() => parseYouTubeVideoUrl("https://example.com/watch?v=0cK5OAHjgws"));
assert.throws(() => parseYouTubePlaylistUrl("https://youtube.com/playlist"));

console.log("YouTube playlist-context link tests passed.");
