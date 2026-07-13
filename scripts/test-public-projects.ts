import assert from "node:assert/strict";

import {
  PUBLIC_PROJECT_MIN_RELEASES,
  evaluatePublicProjectEligibility,
  getPublicProjectPath,
  getPublicProjectSeriesId,
  isAllowlistedPublicProjectSlug
} from "../lib/public-projects";

function project(overrides: Partial<Parameters<typeof evaluatePublicProjectEligibility>[0]> = {}) {
  return evaluatePublicProjectEligibility({
    description: "A controlled public project description.",
    name: "Multiversus",
    publicReleaseSlugs: ["one", "two"],
    slug: "multiversus",
    ...overrides
  });
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
  assert.equal(getPublicProjectPath("switch"), "/projects/switch");
  assert.equal(
    getPublicProjectSeriesId("https://vvviruz.com/", "mi"),
    "https://vvviruz.com/projects/mi#series"
  );

  console.log("Public project eligibility checks passed.");
}

run();
