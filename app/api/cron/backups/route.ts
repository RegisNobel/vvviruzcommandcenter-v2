export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import {NextResponse} from "next/server";

import {
  uploadBackupArtifactToBlob,
  type BackupArtifactType
} from "@/lib/backups/blob-storage";
import {checksumSha256, encryptBackupArtifact} from "@/lib/backups/encryption";
import {uploadBackupArtifactToGoogleDrive} from "@/lib/backups/google-drive";
import {
  createAssetManifestArtifact,
  createDatabaseSnapshotArtifact
} from "@/lib/backups/snapshot";
import {
  createBackupRun,
  markBackupRunFailed,
  markBackupRunSuccess,
  type BackupRunType
} from "@/lib/repositories/backups";

type BackupJob = {
  blobType: BackupArtifactType;
  fileStem: string;
  runType: BackupRunType;
  createArtifact: () => Promise<{
    buffer: Buffer;
    checksumSha256: string;
    recordCounts: Record<string, number>;
    sizeBytes: number;
  }>;
};

const backupJobs: BackupJob[] = [
  {
    blobType: "database-snapshot",
    fileStem: "vcc-db-snapshot",
    runType: "database_snapshot",
    createArtifact: createDatabaseSnapshotArtifact
  },
  {
    blobType: "asset-manifest",
    fileStem: "vcc-asset-manifest",
    runType: "asset_manifest",
    createArtifact: createAssetManifestArtifact
  }
];

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function runBackupJob(job: BackupJob) {
  const run = await createBackupRun(job.runType);

  try {
    const artifact = await job.createArtifact();
    const encryptedBuffer = encryptBackupArtifact(artifact.buffer);
    const encryptedChecksum = checksumSha256(encryptedBuffer);
    const blob = await uploadBackupArtifactToBlob({
      buffer: encryptedBuffer,
      fileStem: job.fileStem,
      type: job.blobType
    });
    const driveFileName = blob.pathname.split("/").pop() || `${job.fileStem}.json.gz`;
    const drive = await uploadBackupArtifactToGoogleDrive({
      buffer: encryptedBuffer,
      fileName: driveFileName
    });
    const destinations = ["vercel_blob"];

    if (drive.enabled) {
      destinations.push("google_drive");
    }

    await markBackupRunSuccess(run.id, {
      blobPath: blob.pathname,
      checksumSha256: encryptedChecksum,
      destination: destinations.join(","),
      googleDriveFileId: drive.enabled ? drive.fileId : null,
      googleDriveFolderId: drive.enabled ? drive.folderId : null,
      recordCounts: artifact.recordCounts,
      sizeBytes: encryptedBuffer.byteLength
    });

    return {
      blobPath: blob.pathname,
      destinations,
      googleDrive: drive.enabled ? "uploaded" : drive.reason,
      recordCounts: artifact.recordCounts,
      runId: run.id,
      sizeBytes: encryptedBuffer.byteLength,
      status: "success",
      type: job.runType
    };
  } catch (error) {
    await markBackupRunFailed(run.id, error);

    return {
      error: error instanceof Error ? error.message : "Backup failed.",
      runId: run.id,
      status: "failed",
      type: job.runType
    };
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({message: "Unauthorized."}, {status: 401});
  }

  const results = [];

  for (const job of backupJobs) {
    results.push(await runBackupJob(job));
  }

  const failed = results.some((result) => result.status === "failed");

  return NextResponse.json(
    {
      ok: !failed,
      results
    },
    {status: failed ? 500 : 200}
  );
}
