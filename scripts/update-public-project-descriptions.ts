import {prisma} from "../lib/db/prisma";
import {createId} from "../lib/utils";

const projects = [
  {
    name: "Multiversus",
    slug: "multiversus",
    description: `Multiversus is an ongoing nerdcore battle series that brings characters from different fictional universes face-to-face through music. Each release turns a dream matchup into a high-energy clash of perspectives, abilities, personalities, and bars, with cinematic production, character-driven writing, and memorable chant-style hooks.

From anime rivals to action icons, every installment asks the same question: when two worlds collide, who comes out on top?`
  },
  {
    name: "Switch Series",
    slug: "switch",
    description: `Switch is a recurring rap series built around transformation. Each installment challenges vvviruz and his collaborators to switch languages, flows, cadences, perspectives, structures, or delivery styles without losing control of the song.

The series highlights technical writing, bilingual and multilingual performances, sharp transitions, and the ability to adapt whenever the beat or concept changes.`
  },
  {
    name: "Lover Boy",
    slug: "loverboy",
    description: `Lover Boy explores the more emotional and vulnerable side of vvviruz. The project moves beyond battle-ready confidence to examine attraction, attachment, longing, distance, communication, and the feelings that become difficult to express when a relationship matters.

Through melodic production and direct songwriting, Lover Boy shows that vulnerability and intensity can exist within the same artist.`
  },
  {
    name: "Massive Imitation",
    slug: "mi",
    description: `Massive Imitation is a five-track project about influence, reinvention, ambition, and identity. Each song draws from a different corner of rap and reshapes that inspiration through vvviruz's own writing, multilingual delivery, beat switches, and perspective.

Across bold introductions, victory-lap energy, swagger, nostalgia, and reflections on pressure and authenticity, the project explores the difference between copying what came before and transforming it into something personal.`
  },
  {
    name: "Off the Grid",
    slug: "off-the-grid",
    description: `Off the Grid is where vvviruz abandons restraint and steps outside his usual style of layered concepts, calculated wordplay, and character-driven writing. The project leans into a more aggressive, vulgar, and unapologetically mainstream sound built around heavy production, reckless confidence, dirty bars, and immediate impact.

Instead of overthinking every line, Off the Grid prioritizes energy, attitude, instinct, and the freedom to say what would normally be filtered out. It is not a replacement for the core vvviruz sound. It is the version that comes out when the rules, expectations, and internal censor are switched off.`
  }
] as const;

async function run() {
  const lastCategory = await prisma.releaseCategory.findFirst({
    orderBy: {sortOrder: "desc"},
    select: {sortOrder: true}
  });
  let nextSortOrder = (lastCategory?.sortOrder ?? -1) + 1;
  const now = new Date();

  for (const project of projects) {
    const existing = await prisma.releaseCategory.findUnique({
      where: {slug: project.slug},
      select: {id: true}
    });

    if (existing) {
      await prisma.releaseCategory.update({
        where: {id: existing.id},
        data: {
          description: project.description,
          name: project.name,
          updatedAt: now
        }
      });
      continue;
    }

    await prisma.releaseCategory.create({
      data: {
        id: createId(),
        name: project.name,
        slug: project.slug,
        description: project.description,
        sortOrder: nextSortOrder,
        createdAt: now,
        updatedAt: now
      }
    });
    nextSortOrder += 1;
  }

  const audit = await prisma.releaseCategory.findMany({
    where: {slug: {in: projects.map((project) => project.slug)}},
    orderBy: [{sortOrder: "asc"}, {name: "asc"}],
    select: {
      name: true,
      slug: true,
      description: true,
      releases: {
        where: {release: {isPublished: true}},
        select: {release: {select: {slug: true}}}
      }
    }
  });

  for (const project of audit) {
    console.log(
      `${project.name} (${project.slug}): ${project.releases.length} public releases, description ${project.description.trim() ? "ready" : "missing"}`
    );
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
