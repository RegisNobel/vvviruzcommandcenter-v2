import assert from "node:assert/strict";

import {
  PUBLIC_PROJECT_MIN_RELEASES,
  evaluatePublicProjectEligibility,
  getPublicProjectPath,
  getPublicProjectSeriesId,
  isAllowlistedPublicProjectSlug,
  normalizeApprovedPublicProjectSlugs
} from "../lib/public-projects";

function project(
  overrides: Partial<Parameters<typeof evaluatePublicProjectEligibility>[0]> = {},
  approvedProjectSlugs?: ReadonlySet<string>
) {
  return evaluatePublicProjectEligibility({
    description: "A controlled public project description.",
    name: "Multiversus",
    publicReleaseSlugs: ["one", "two"],
    slug: "multiversus",
    ...overrides
  }, approvedProjectSlugs);
}

function run() {
  assert.equal(PUBLIC_PROJECT_MIN_RELEASES, 2);
  assert.deepEqual(project(), {eligible: true, reason: null, slug: "multiversus"});
  assert.equal(project({description: ""}).reason, "missing-description");
  assert.equal(project({publicReleaseSlugs: ["one"]}).reason, "insufficient-public-releases");
  assert.equal(project({slug: "internal-campaign"}).reason, "not-allowlisted");
  assert.equal(project({slug: ""}).reason, "missing-slug");
  assert.equal(project({name: ""}).reason, "missing-name");
  assert.equal(project({publicReleaseSlugs: ["one", ""]}).reason, "missing-public-release-slug");
  assert.equal(isAllowlistedPublicProjectSlug("off-the-grid"), true);
  assert.deepEqual(
    normalizeApprovedPublicProjectSlugs(undefined),
    ["multiversus", "switch", "loverboy", "mi", "off-the-grid"],
    "Missing configuration should preserve the static public-project fallback."
  );
  assert.deepEqual(
    normalizeApprovedPublicProjectSlugs([]),
    [],
    "An explicitly saved empty project list should remain empty."
  );
  assert.deepEqual(
    normalizeApprovedPublicProjectSlugs([" Custom-Project ", "custom-project", "switch"]),
    ["custom-project", "switch"],
    "Configured project slugs should be normalized, deduplicated, and order-preserving."
  );
  assert.deepEqual(
    project({slug: "custom-project"}, new Set(["custom-project"])),
    {eligible: true, reason: null, slug: "custom-project"},
    "Configured category slugs should be eligible without changing the static fallback list."
  );
  assert.equal(getPublicProjectPath("switch"), "/projects/switch");
  assert.equal(
    getPublicProjectSeriesId("https://vvviruz.com/", "mi"),
    "https://vvviruz.com/projects/mi#series"
  );

  console.log("Public project eligibility checks passed.");
}

run();
