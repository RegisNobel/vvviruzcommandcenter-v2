import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {attemptBackupDestinations} from "../lib/backups/destinations";
import {pruneVerifiedBackupCopies, selectBackupPruneCandidates} from "../lib/backups/retention-policy";
import {resolveBundledCover} from "../lib/server/bundled-covers";

async function main() {
  let driveCalls = 0;
  const blobDown = await attemptBackupDestinations(async () => {throw new Error("provider secret");}, async () => {driveCalls++; return "verified-copy";});
  assert.equal(driveCalls, 1);
  assert.equal(blobDown.drive.value, "verified-copy");
  assert.ok(blobDown.blob.error && !blobDown.blob.error.includes("secret"));
  const driveDown = await attemptBackupDestinations(async () => "blob-copy", async () => {throw new Error("down");});
  assert.equal(driveDown.blob.value, "blob-copy");
  assert.ok(driveDown.drive.error);
  const bothDown = await attemptBackupDestinations(async () => {throw new Error();}, async () => {throw new Error();});
  assert.ok(bothDown.blob.error && bothDown.drive.error);

  const now = new Date("2026-10-12T12:00:00Z");
  const runs = [1, 2, 9, 10, 11].map((age, i) => ({id: String(i), type: "database_snapshot", startedAt: new Date(now.getTime() - age * 86400_000), blobPath: `database-backups/${i}`, googleDriveFileId: `drive-${i}`, checksumSha256: "a".repeat(64), sizeBytes: 42}));
  assert.deepEqual(selectBackupPruneCandidates(runs, now).map(r => r.id), ["4", "3", "2"]);
  assert.deepEqual(selectBackupPruneCandidates(runs.slice(2, 4), now), []); // last two survive even when old
  assert.equal(selectBackupPruneCandidates(runs.map(r => ({...r, googleDriveFileId: null})), now).length, 0);
  const events: string[] = [];
  const result = await pruneVerifiedBackupCopies(["valid", "bad-hash", "bad-key", "missing"], {
    async verify(id) {events.push(`verify:${id}`); if (id !== "valid") throw new Error(id);},
    async remove(id) {events.push(`delete:${id}`);}
  });
  assert.deepEqual(result, {deleted: 1, blocked: 3});
  assert.deepEqual(events, ["verify:valid", "delete:valid", "verify:bad-hash", "verify:bad-key", "verify:missing"]);

  for (const file of ["38e8f37a-df60-4293-a7d3-88bcd016580e.jpg", "5c354117-66ec-4f4f-a033-a18fccbbbe6c.jpg"]) {
    assert.equal(resolveBundledCover(`/api/assets/cover/${file}`), `/project-covers/${file}`);
    assert.equal(resolveBundledCover(`https://der42gjtvxvutavf.public.blob.vercel-storage.com/vvviruz/cover/${file}`), `/project-covers/${file}`);
    assert.ok((await fs.stat(`public/project-covers/${file}`)).size > 1000);
  }
  assert.equal(resolveBundledCover("/api/assets/cover/unpublished.jpg"), null);
  assert.equal(resolveBundledCover("https://unrelated.example/cover/38e8f37a-df60-4293-a7d3-88bcd016580e.jpg"), null);
  console.log("Independent backup destinations, fail-closed retention, minimum recovery copies, and bundled artwork checks passed.");
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
