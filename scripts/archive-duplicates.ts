import { PrismaClient } from '@prisma/client';
import { resolveEffectiveCopyLinksForRelease } from '../lib/repositories/ads';

const prisma = new PrismaClient();

const TARGET_DUPLICATES = [
  {
    id: 'c3d464ad-24a3-4f0e-b0c7-544b419f2509',
    expectedHook: 'when you look sweet but lowkey a certfied crashout',
    canonicalId: 'ec4d1778-e95d-4c24-998b-b048b5621b5c',
    expectedCanonicalHook: 'when you look sweet but lowkey a certified crashout',
    family: 'certified crashout'
  },
  {
    id: '37edf0ca-3cb2-472d-8db0-5f49135ba4ad',
    expectedHook: 'pov: the devil may cry rabbit turned into a rapper',
    canonicalId: '94569e36-529c-4532-b738-d0921efb49c0',
    expectedCanonicalHook: 'pov: the devil may cry rabbit turned into a rapper',
    family: 'devil may cry rapper'
  },
  {
    id: 'dedf79aa-b89a-4577-93a8-55387cb81d30',
    expectedHook: 'yall done pissed off the wrong rabbit',
    canonicalId: '6364942e-502a-4953-9c9e-11132ec8f75f',
    expectedCanonicalHook: 'yall done pissed off the wrong rabbit.',
    family: 'wrong rabbit'
  }
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');

  if (!dryRun && !apply) {
    console.error('Error: Please specify either --dry-run or --apply');
    process.exit(1);
  }

  console.log(`=== RUNNING COPY ARCHIVE PASS (Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}) ===\n`);

  // 1. Fetch Mad Bunny Release
  const release = await prisma.release.findFirst({
    where: { slug: 'mad-bunny' }
  });

  if (!release) {
    console.error('Verification failed: Mad Bunny release (slug: "mad-bunny") not found.');
    process.exit(1);
  }
  console.log(`Verified Release: ${release.title} (ID: ${release.id})\n`);

  // 2. Fetch all reports for the release and resolve effective links to check for carryover
  const batches = await prisma.adImportBatch.findMany({
    where: { releaseId: release.id },
    include: {
      reports: {
        include: {
          copyLinks: {
            include: {
              copyEntry: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const reports = batches.flatMap(b => b.reports) as any[];
  await resolveEffectiveCopyLinksForRelease(release.id, reports);

  // Build sets of copies that have direct or carried links
  const directLinkedIds = new Set<string>();
  const carriedLinkedIds = new Set<string>();

  for (const r of reports) {
    if (r.copyLinkSource === 'direct') {
      for (const link of r.effectiveCopyLinks || []) {
        directLinkedIds.add(link.copyEntryId);
      }
    } else if (r.copyLinkSource === 'carryover') {
      for (const link of r.effectiveCopyLinks || []) {
        carriedLinkedIds.add(link.copyEntryId);
      }
    }
  }

  let verifiedCount = 0;
  const toArchive: string[] = [];

  for (const duplicate of TARGET_DUPLICATES) {
    console.log(`Checking Duplicate Family: "${duplicate.family}"`);

    // Fetch the duplicate copy from DB
    const dupRecord = await prisma.copyEntry.findUnique({
      where: { id: duplicate.id },
      include: { release: true }
    });

    if (!dupRecord) {
      console.log(`  ❌ Skip: Duplicate record ID ${duplicate.id} not found in database.`);
      continue;
    }

    // Verify Release
    if (dupRecord.releaseId !== release.id) {
      console.log(`  ❌ Skip: Duplicate record releaseId (${dupRecord.releaseId}) does not match Mad Bunny.`);
      continue;
    }

    // Verify Hook Text
    if (dupRecord.hook.trim().toLowerCase() !== duplicate.expectedHook.toLowerCase()) {
      console.log(`  ❌ Skip: Duplicate hook text "${dupRecord.hook}" does not match expected "${duplicate.expectedHook}".`);
      continue;
    }

    // Verify direct links
    const directLinkCount = await prisma.adCreativeCopyLink.count({
      where: { copyEntryId: duplicate.id }
    });
    if (directLinkCount > 0 || directLinkedIds.has(duplicate.id)) {
      console.log(`  ❌ Skip: Duplicate record has ${directLinkCount} direct AdCreativeCopyLink usages.`);
      continue;
    }

    // Verify effective/carryover links
    if (carriedLinkedIds.has(duplicate.id)) {
      console.log(`  ❌ Skip: Duplicate record has effective carryover link usage in ad reports.`);
      continue;
    }

    // Fetch canonical copy from DB
    const canonicalRecord = await prisma.copyEntry.findUnique({
      where: { id: duplicate.canonicalId }
    });

    if (!canonicalRecord) {
      console.log(`  ❌ Skip: Canonical record ID ${duplicate.canonicalId} not found in database.`);
      continue;
    }

    // Verify canonical release
    if (canonicalRecord.releaseId !== release.id) {
      console.log(`  ❌ Skip: Canonical record releaseId (${canonicalRecord.releaseId}) does not match Mad Bunny.`);
      continue;
    }

    // Verify canonical hook text
    if (canonicalRecord.hook.trim().toLowerCase() !== duplicate.expectedCanonicalHook.toLowerCase()) {
      console.log(`  ❌ Skip: Canonical hook text "${canonicalRecord.hook}" does not match expected "${duplicate.expectedCanonicalHook}".`);
      continue;
    }

    // Verify canonical record is linked/active
    const canonicalDirectLinks = await prisma.adCreativeCopyLink.count({
      where: { copyEntryId: duplicate.canonicalId }
    });
    if (canonicalDirectLinks === 0 && !directLinkedIds.has(duplicate.canonicalId) && !carriedLinkedIds.has(duplicate.canonicalId)) {
      console.log(`  ⚠️ Warning: Canonical record is not linked to any ad report, but we will proceed.`);
    }

    console.log(`  ✅ Verified: Duplicate family is ready to archive.`);
    console.log(`     - Duplicate ID: ${duplicate.id} (${dupRecord.hook})`);
    console.log(`     - Canonical ID: ${duplicate.canonicalId} (${canonicalRecord.hook}) [Direct links: ${canonicalDirectLinks}]`);
    
    toArchive.push(duplicate.id);
    verifiedCount++;
  }

  console.log(`\nVerified ${verifiedCount} / ${TARGET_DUPLICATES.length} legacy duplicates.`);

  if (apply) {
    if (toArchive.length === 0) {
      console.log('No duplicates verified for archiving. Skipping apply.');
      return;
    }

    console.log(`\nArchiving ${toArchive.length} verified copies...`);
    const now = new Date();
    const result = await prisma.copyEntry.updateMany({
      where: { id: { in: toArchive } },
      data: {
        archivedAt: now,
        archiveReason: 'Legacy duplicate from previous Copy Lab system'
      }
    });

    console.log(`Success: Archived ${result.count} copy records in the database.`);
  } else {
    console.log('\nDRY-RUN completed. No records were modified.');
    console.log('To apply the archive, run with: npx tsx scripts/archive-duplicates.ts --apply');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
