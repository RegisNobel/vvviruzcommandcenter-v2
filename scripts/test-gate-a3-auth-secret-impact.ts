import assert from "node:assert/strict";

async function main() {
  const previousAuth = process.env.AUTH_SECRET;
  const previousBackup = process.env.BACKUP_ENCRYPTION_SECRET;
  const oldSecret = "old-auth-secret-for-isolated-gate-a3-testing-1234567890";
  const newSecret = "new-auth-secret-for-isolated-gate-a3-testing-0987654321";
  process.env.AUTH_SECRET = oldSecret;
  process.env.BACKUP_ENCRYPTION_SECRET = "backup-secret-remains-independent-through-gate-a3";

  const [crypto, session, spotify, attribution, backup] = await Promise.all([
    import("../lib/auth/crypto"),
    import("../lib/auth/session"),
    import("../lib/analytics/spotify-preview-token"),
    import("../lib/server/short-link-attribution"),
    import("../lib/backups/encryption")
  ]);
  try {
    const totpMaterial = "JBSWY3DPEHPK3PXP";
    const encryptedTotp = crypto.encryptSecret(totpMaterial);
    assert.equal(crypto.decryptSecret(encryptedTotp), totpMaterial);
    const oldCookie = session.createSessionCookieValue({sid: "gate-a3-old", stage: "authenticated", exp: Date.now() + 60_000, v: 1});
    assert.equal(session.parseSessionCookie(oldCookie)?.sid, "gate-a3-old");
    const oldPreview = spotify.createSpotifyPreviewToken({
      userId: "gate-a3-user",
      fileHash: "a".repeat(64),
      parserVersion: "1.0.0",
      normalizationVersion: 1,
      detectedType: "ARTIST_AUDIENCE_TIMELINE",
      parsedResultChecksum: "b".repeat(64),
      temporaryRawFileReference: "gate-a3-isolated-preview.csv",
      originalFileName: "gate-a3.csv",
      mimeType: "text/csv",
      sizeBytes: 1,
      previewPeriod: null,
      candidateArtistProfileId: null,
      candidateReleaseId: null,
      reprocessSourceImportId: null
    });
    assert.ok(spotify.readSpotifyPreviewToken(oldPreview.token));
    const oldAttribution = attribution.createShortLinkAttributionToken("gate-a3-link");
    assert.equal(attribution.verifyShortLinkAttributionToken(oldAttribution), "gate-a3-link");
    const encryptedBackup = backup.encryptBackupArtifact(Buffer.from("gate-a3-backup-check"));

    process.env.AUTH_SECRET = newSecret;
    assert.equal(session.parseSessionCookie(oldCookie), null);
    assert.equal(spotify.readSpotifyPreviewToken(oldPreview.token), null);
    assert.equal(attribution.verifyShortLinkAttributionToken(oldAttribution), null);
    assert.throws(() => crypto.decryptSecret(encryptedTotp));
    const newCookie = session.createSessionCookieValue({sid: "gate-a3-new", stage: "authenticated", exp: Date.now() + 60_000, v: 1});
    assert.equal(session.parseSessionCookie(newCookie)?.sid, "gate-a3-new");
    const newPreview = spotify.createSpotifyPreviewToken({...oldPreview.payload, previewId: undefined, expiresAt: undefined} as never);
    assert.ok(spotify.readSpotifyPreviewToken(newPreview.token));
    const newAttribution = attribution.createShortLinkAttributionToken("gate-a3-link");
    assert.equal(attribution.verifyShortLinkAttributionToken(newAttribution), "gate-a3-link");
    assert.equal(backup.decryptBackupArtifact(encryptedBackup).toString("utf8"), "gate-a3-backup-check");
    console.log(JSON.stringify({
      oldSessionRejected: true,
      newSessionAccepted: true,
      oldSpotifyPreviewRejected: true,
      newSpotifyPreviewAccepted: true,
      abandonedPreviewFileCreated: false,
      oldShortLinkAttributionRejected: true,
      newShortLinkAttributionAccepted: true,
      totpRequiresReencryption: true,
      backupEncryptionUnaffected: true,
      cronSecretUnaffectedByDesign: true
    }, null, 2));
  } finally {
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
    if (previousBackup === undefined) delete process.env.BACKUP_ENCRYPTION_SECRET;
    else process.env.BACKUP_ENCRYPTION_SECRET = previousBackup;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
