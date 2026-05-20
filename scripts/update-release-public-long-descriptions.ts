import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

type ReleaseDescriptionUpdate = {
  title: string;
  slug: string;
  publicLongDescription: string;
};

const releaseDescriptionUpdates: ReleaseDescriptionUpdate[] = [
  {
    title: "BOSSS",
    slug: "bosss",
    publicLongDescription:
      `"BOSSS" takes the bold, unapologetic pop-rap energy of Cardi B and Megan Thee Stallion's "WAP" and flips it into vvviruz territory. The point is not pure shock value; it is boss talk, room-commanding confidence, and exaggerated villain-mode charisma.\n\n` +
      "The track sits inside the Massive Imitation lane as a reinterpretation, using a familiar cultural spark as a launchpad for vvviruz's own language. It feels cocky, bilingual-friendly, and performance-driven: a loud flex record for moments when subtlety is not the mission."
  },
  {
    title: "Alphabetical",
    slug: "alphabetical-5bb62ae7",
    publicLongDescription:
      `"Alphabetical" is a technical wordplay record built around a simple challenge: take the alphabet and make it rap. The A-to-Z structure gives the song a clear constraint, but the real point is proving how much can be done inside that frame.\n\n` +
      "This is not a deep backstory record; it is proof of skill. vvviruz turns a children's-learning concept into a proving ground, using confidence, structure, and sharp delivery to make the familiar feel harder than expected."
  },
  {
    title: "Introduction",
    slug: "introduction-12d71494",
    publicLongDescription:
      `"Introduction" is a self-introduction built around arrival, identity, and self-belief. Inspired by EL's "King Without a Crown," the record carries the idea of moving like royalty before anyone officially hands you the crown.\n\n` +
      "As an opening statement, it leans into underdog energy and the refusal to wait for permission. With MK243 featured and a place inside Massive Imitation, the track frames vvviruz as someone already stepping into the room with purpose, bilingual identity, and something to prove."
  },
  {
    title: "Lover",
    slug: "lover-705a6bf3",
    publicLongDescription:
      `"Lover" shows the softer romantic side of vvviruz without turning the feeling into sugar. The song treats love as something worth climbing toward, building toward, and proving through action.\n\n` +
      "It is commitment-minded: love, family, wife, future, and the idea of building a life instead of just chasing a moment. Bilingual and sincere, it brings the same focus usually reserved for ambition into a record about choosing love with loyalty and intention."
  },
  {
    title: "Real",
    slug: "real",
    publicLongDescription:
      `"Real" is a cinematic reinterpretation about truth, visibility, and being seen clearly beyond the noise. Inspired by Kanye West's "All of the Lights," the song uses a recognizable source of scale and pressure as the starting point for something more personal.\n\n` +
      "Inside the Massive Imitation lane, vvviruz filters that influence through his own voice: image versus reality, ambition versus self-awareness, and the need to be understood as more than a surface impression. It is about standing in what is authentic without pretending to be something else."
  }
];

async function main() {
  let updated = 0;
  let unchanged = 0;
  let missing = 0;

  for (const item of releaseDescriptionUpdates) {
    const release = await prisma.release.findFirst({
      where: {
        OR: [{slug: item.slug}, {title: item.title}]
      },
      select: {
        id: true,
        title: true,
        slug: true,
        publicLongDescription: true
      }
    });

    if (!release) {
      missing += 1;
      console.warn(`Missing release: ${item.title} (${item.slug})`);
      continue;
    }

    if (release.publicLongDescription === item.publicLongDescription) {
      unchanged += 1;
      console.log(`Unchanged: ${release.title}`);
      continue;
    }

    await prisma.release.update({
      where: {id: release.id},
      data: {
        publicLongDescription: item.publicLongDescription,
        updatedOn: new Date()
      }
    });

    updated += 1;
    console.log(`Updated: ${release.title}`);
  }

  console.log(
    `Release publicLongDescription update complete. Updated: ${updated}. Unchanged: ${unchanged}. Missing: ${missing}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
