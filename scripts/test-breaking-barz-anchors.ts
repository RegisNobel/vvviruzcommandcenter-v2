import assert from "node:assert/strict";

import {parseCanonicalLyrics} from "../lib/lyrics";
import {
  createReleaseAnnotationAnchor,
  rebaseReleaseAnnotationAnchor,
  validateReleaseAnnotationAnchor
} from "../lib/server/release-annotation-anchors";

const repeatedChoruses = [
  "[Verse 1]",
  "Set the scene",
  "Move with intent",
  "",
  "[Chorus]",
  "Evolve or you die",
  "But I die and evolve",
  "",
  "[Chorus]",
  "Evolve or you die",
  "But I die and evolve"
].join("\n");

const document = parseCanonicalLyrics(repeatedChoruses);
assert.equal(document.sections[1]?.key, "chorus");
assert.equal(document.sections[1]?.occurrence, 0);
assert.equal(document.sections[2]?.key, "chorus");
assert.equal(document.sections[2]?.occurrence, 1);
assert.deepEqual(document.sections[2]?.lines.map((line) => line.lineIndex), [0, 1]);

const secondChorusAnchor = createReleaseAnnotationAnchor({
  lyrics: repeatedChoruses,
  sectionKey: "chorus",
  sectionOccurrence: 1,
  startLineIndex: 0,
  endLineIndex: 1
});

const unchangedDuplicate = validateReleaseAnnotationAnchor(
  repeatedChoruses,
  secondChorusAnchor
);
assert.equal(unchangedDuplicate.valid, true);

const insertedBeforeRange = repeatedChoruses.replace(
  "[Chorus]\nEvolve or you die\nBut I die and evolve",
  "[Chorus]\nCrowd knows the signal\nEvolve or you die\nBut I die and evolve"
);
const rebased = rebaseReleaseAnnotationAnchor({
  oldLyrics: repeatedChoruses,
  newLyrics: insertedBeforeRange,
  anchor: createReleaseAnnotationAnchor({
    lyrics: repeatedChoruses,
    sectionKey: "chorus",
    sectionOccurrence: 0,
    startLineIndex: 0,
    endLineIndex: 1
  })
});
assert.equal(rebased.valid, true);
if (rebased.valid) {
  assert.equal(rebased.rebased, true);
  assert.equal(rebased.anchor.startLineIndex, 1);
  assert.equal(rebased.anchor.endLineIndex, 2);
}

const changedInsideRange = rebaseReleaseAnnotationAnchor({
  oldLyrics: repeatedChoruses,
  newLyrics: repeatedChoruses.replace(
    "But I die and evolve",
    "But we rise and evolve"
  ),
  anchor: createReleaseAnnotationAnchor({
    lyrics: repeatedChoruses,
    sectionKey: "chorus",
    sectionOccurrence: 0,
    startLineIndex: 0,
    endLineIndex: 1
  })
});
assert.equal(changedInsideRange.valid, false);

const ambiguousOldLyrics = "[Verse 1]\nOpening line\nTarget bar\nClosing line";
const ambiguous = rebaseReleaseAnnotationAnchor({
  oldLyrics: ambiguousOldLyrics,
  newLyrics: "[Verse 1]\nOpening line\nTarget bar\nTarget bar\nClosing line",
  anchor: createReleaseAnnotationAnchor({
    lyrics: ambiguousOldLyrics,
    sectionKey: "verse_1",
    sectionOccurrence: 0,
    startLineIndex: 1,
    endLineIndex: 1
  })
});
assert.equal(ambiguous.valid, false);

const unicodeDocument = parseCanonicalLyrics("[Verse]\nCafe\u0301 → “signal” · réponse");
assert.equal(unicodeDocument.lines[0]?.text, "Café → “signal” · réponse");

console.log("Breaking Barz canonical lyric and anchor tests passed.");
