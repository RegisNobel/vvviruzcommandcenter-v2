import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../storage/vvviruz-command-center.db'
    }
  }
});

async function main() {
  console.log('--- SITE SETTINGS ---');
  const settings = await prisma.siteSettings.findFirst();
  console.log('Site settings found:', settings ? 'Yes' : 'No');
  if (settings) {
    console.log('Artist Name:', settings.artistName);
    console.log('LinksItems:', settings.linksPageItems);
  }

  console.log('--- RELEASES ---');
  const releases = await prisma.release.findMany({
    where: { isPublished: true },
    take: 5
  });
  console.log(`Found ${releases.length} published releases.`);
  for (const r of releases) {
    console.log(`- Slug: ${r.slug}, CoverArtPath: ${r.coverArtPath}, Title: ${r.title}`);
  }

  console.log('--- APPEARS ON ---');
  const appears = await prisma.appearsOn.findMany({
    where: { isPublished: true },
    take: 5
  });
  console.log(`Found ${appears.length} published AppearsOn entries.`);
  for (const a of appears) {
    console.log(`- Title: ${a.title}, CoverArtUrl: ${a.coverArtUrl}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
