import assert from "node:assert/strict";

import {normalizeLyrics, parseLyrics} from "../lib/lyrics";

const normalized = normalizeLyrics(
  "\uFEFF\r\n[Verse 1]   \r\n\r\n\r\nLine one    \rLine two\r\n\r\n\r\n[Chorus]\r\nHook one\r\nHook one\r\n"
);

assert.equal(
  normalized,
  "[Verse 1]\n\nLine one\nLine two\n\n[Chorus]\nHook one\nHook one"
);
assert.equal(normalizeLyrics("   \n\t\n"), "");
assert.equal(normalizeLyrics("C'est déjà là\n日本語\nEspañol"), "C'est déjà là\n日本語\nEspañol");
assert.equal(normalizeLyrics("  keep leading spaces\ninside  spaces"), "  keep leading spaces\ninside  spaces");

const tokens = parseLyrics(
  "[Verse 1]\nLine with [brackets]\n\n[CHORUS]\nSame line\nSame line\n[]\n[Broken"
);

assert.deepEqual(
  tokens.map(({type, ...token}) => ({type, text: "text" in token ? token.text : undefined})),
  [
    {type: "heading", text: "Verse 1"},
    {type: "line", text: "Line with [brackets]"},
    {type: "spacer", text: undefined},
    {type: "heading", text: "CHORUS"},
    {type: "line", text: "Same line"},
    {type: "line", text: "Same line"},
    {type: "line", text: "[]"},
    {type: "line", text: "[Broken"}
  ]
);
assert.deepEqual(parseLyrics(""), []);
assert.equal(parseLyrics("<script>alert('test')</script>")[0]?.type, "line");

console.log("Lyrics normalization and parser tests passed.");
