import assert from "node:assert/strict";

import {
  createEmptyArtistIntakeResponse
} from "../lib/artist-intake";
import {prisma} from "../lib/db/prisma";
import {
  convertArtistIntakeToDraft,
  createArtistIntakeInvite,
  markArtistIntakeReviewed,
  readArtistIntakeForAdmin,
  saveArtistIntakeResponse
} from "../lib/repositories/artist-intakes";
import {
  createArtistPreviewVersion,
  publishArtistProfile,
  readArtistPreviewByToken,
  readPublishedArtistProfile,
  recordArtistProfileApproval,
  revokeArtistPreviewVersion,
  saveArtistProfile
} from "../lib/repositories/artist-profiles";

const runId = crypto.randomUUID();
const profileId = `workflow-polish-${runId}`;
let convertedProfileId = "";
let intakeId = "";

async function cleanup() {
  if (intakeId) {
    await prisma.artistIntake.deleteMany({where: {id: intakeId}});
  }
  for (const id of [convertedProfileId, profileId].filter(Boolean)) {
    await prisma.artistProfile.deleteMany({where: {id}});
    await prisma.release.deleteMany({
      where: {id: {startsWith: `artist-intake-${intakeId}-`}}
    });
  }
}

async function main() {
try {
  await saveArtistProfile({
    id: profileId,
    slug: `workflow-polish-${runId}`,
    displayName: "Workflow Polish Test",
    privateContactEmail: "",
    longBio: "A test artist profile.",
    differentiator: "A safe workflow test.",
    featuredItems: [],
    featuredStories: [],
    links: []
  });

  const firstPreview = await createArtistPreviewVersion(profileId);
  const firstVersion = await prisma.artistProfileVersion.findFirstOrThrow({
    where: {artistProfileId: profileId, version: firstPreview.version}
  });
  assert(firstVersion.previewExpiresAt);
  await recordArtistProfileApproval({
    artistProfileId: profileId,
    versionId: firstVersion.id,
    decidedByEmail: "",
    notes: "Workflow test approval."
  });
  const approvalWithoutEmail = await prisma.artistProfileApproval.findFirstOrThrow({
    where: {versionId: firstVersion.id}
  });
  assert.equal(approvalWithoutEmail.decidedByEmail, "");
  await publishArtistProfile(profileId, firstVersion.id);
  assert(await readPublishedArtistProfile(`workflow-polish-${runId}`));

  await saveArtistProfile({
    id: profileId,
    slug: `workflow-polish-draft-${runId}`,
    displayName: "Workflow Polish Test",
    privateContactEmail: "artist@example.com",
    longBio: "A newer unpublished draft.",
    differentiator: "A safe workflow test.",
    featuredItems: [],
    featuredStories: [],
    links: []
  });
  const updatePreview = await createArtistPreviewVersion(profileId);
  assert(
    await readPublishedArtistProfile(`workflow-polish-${runId}`),
    "The published snapshot must remain live while an update is reviewed."
  );
  assert.equal(
    await readPublishedArtistProfile(`workflow-polish-draft-${runId}`),
    null,
    "An unpublished draft slug must not become public."
  );

  const supersedingPreview = await createArtistPreviewVersion(profileId);
  assert.equal(
    await readArtistPreviewByToken(updatePreview.token),
    null,
    "A newer preview must invalidate the previous review link."
  );
  const activePreview = await prisma.artistProfileVersion.findFirstOrThrow({
    where: {artistProfileId: profileId, version: supersedingPreview.version}
  });
  await revokeArtistPreviewVersion({
    artistProfileId: profileId,
    versionId: activePreview.id
  });
  assert.equal(await readArtistPreviewByToken(supersedingPreview.token), null);
  assert(await readPublishedArtistProfile(`workflow-polish-${runId}`));

  const invite = await createArtistIntakeInvite({
    artistName: "Converted Intake Test",
    inviteeEmail: "converted@example.com"
  });
  intakeId = invite.id;
  const response = createEmptyArtistIntakeResponse(
    "Converted Intake Test",
    "converted@example.com"
  );
  response.artist.countryCode = "US";
  response.artist.profileImageUrl = "https://example.com/profile.jpg";
  response.artist.profileImageAlt = "Converted Intake Test portrait";
  response.artist.imageRightsConfirmed = true;
  response.artist.soundDescription = "Dense melodic writing.";
  response.artist.differentiator = "Self-produced concept records.";
  response.artist.genres = ["Hip-hop"];
  response.releases[0].title = "Converted Signal";
  response.releases[0].spotifyUrl =
    "https://open.spotify.com/track/converted";
  response.releases[0].coverArtUrl = "https://example.com/cover.jpg";
  response.releases[0].coverArtAlt = "Converted Signal cover";
  response.releases[0].coverArtRightsConfirmed = true;
  response.releases[0].trackSummary = "The recommended starting point.";
  response.submissionConfirmed = true;
  await saveArtistIntakeResponse({
    token: invite.token,
    response,
    submit: true
  });
  await markArtistIntakeReviewed(intakeId);
  convertedProfileId = await convertArtistIntakeToDraft(intakeId);

  const converted = await readArtistIntakeForAdmin(intakeId);
  assert.equal(converted?.status, "CONVERTED");
  assert.equal(converted?.linkedArtistProfileId, convertedProfileId);
  const convertedProfile = await prisma.artistProfile.findUniqueOrThrow({
    where: {id: convertedProfileId},
    include: {primaryReleases: true, versions: true}
  });
  assert.equal(convertedProfile.workflowStatus, "DRAFT");
  assert.equal(convertedProfile.primaryReleases.length, 1);
  assert.equal(convertedProfile.primaryReleases[0]?.isPublished, false);
  assert.equal(convertedProfile.versions.length, 0);

  console.log("Artist workflow polish integration tests passed.");
} finally {
  await cleanup();
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
