import fs from "node:fs/promises";

import {readReleaseRetentionAnalysis} from "../lib/analytics/retention-data";
import {prisma} from "../lib/db/prisma";

async function main() {
  const workflowPath = process.env.GATE_C_WORKFLOW_PATH;
  const outputPath = process.env.GATE_C_FINGERPRINT_PATH;
  if (!workflowPath || !outputPath) throw new Error("Gate C workflow and fingerprint paths are required.");
  const workflow = JSON.parse(await fs.readFile(workflowPath, "utf8")) as {releaseId: string; campaignId: string; importedIds: string[]};
  const analysis = await readReleaseRetentionAnalysis(workflow.releaseId, {
    campaignId: workflow.campaignId,
    now: new Date("2026-08-04T00:00:00.000Z")
  });
  const fingerprint = {
    releaseId: workflow.releaseId,
    campaignId: workflow.campaignId,
    importStatuses: await prisma.analyticsImport.findMany({where: {id: {in: workflow.importedIds}}, orderBy: {id: "asc"}, select: {id: true, status: true, replacedByImportId: true, withdrawnAt: true, rawFileStorageDriver: true, rawFileStorageKey: true, rawFileSizeBytes: true, rawFileExpiresAt: true, rawFileDeletedAt: true}}),
    counts: {
      imports: await prisma.analyticsImport.count({where: {id: {in: workflow.importedIds}}}),
      artistObservations: await prisma.artistMetricObservation.count({where: {importId: {in: workflow.importedIds}}}),
      trackObservations: await prisma.trackMetricObservation.count({where: {importId: {in: workflow.importedIds}}}),
      songSnapshots: await prisma.songPeriodSnapshot.count({where: {importId: {in: workflow.importedIds}}}),
      playlistSnapshots: await prisma.playlistPeriodSnapshot.count({where: {importId: {in: workflow.importedIds}}}),
      mappingRows: await prisma.analyticsImportRow.count({where: {importId: {in: workflow.importedIds}}}),
      aliases: await prisma.releaseImportAlias.count({where: {releaseId: workflow.releaseId}}),
      mappingAudits: await prisma.mappingAuditEvent.count({where: {importId: {in: workflow.importedIds}}}),
      campaigns: await prisma.promotionCampaign.count({where: {id: workflow.campaignId}}),
      evidence: await prisma.campaignEvidence.count({where: {campaignId: workflow.campaignId}}),
      intervals: await prisma.campaignActiveInterval.count({where: {campaignId: workflow.campaignId}}),
      events: await prisma.campaignTimelineEvent.count({where: {campaignId: workflow.campaignId}}),
      campaignAudits: await prisma.campaignAuditEvent.count({where: {campaignId: workflow.campaignId}})
    },
    analysis: {
      status: analysis.status,
      confidence: analysis.confidence,
      windows: analysis.windows,
      campaign: analysis.campaign,
      growth: analysis.growth,
      trackPersistence: analysis.trackPersistence,
      reasonCodes: analysis.reasonCodes,
      provenance: analysis.provenance,
      inputImportIds: analysis.inputImportIds
    }
  };
  await fs.writeFile(outputPath, JSON.stringify(fingerprint, null, 2));
  console.log(JSON.stringify({message: "Gate C retention fingerprint written.", counts: fingerprint.counts, status: analysis.status, confidence: analysis.confidence}));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
