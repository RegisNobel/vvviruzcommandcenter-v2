import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

type ReleaseDescriptionUpdate = {
  title: string;
  slug: string;
  publicLongDescription: string;
};

const releaseDescriptionUpdates: ReleaseDescriptionUpdate[] = [
  {
    title: "Mad Bunny",
    slug: "mad-bunny",
    publicLongDescription:
      `"Mad Bunny" is a dark nerdcore record inspired by Netflix's Devil May Cry, built around chaotic anti-hero energy. The song puts the listener in a city-on-fire frame where violence, control, and identity all collide.\n\n` +
      "The delivery is aggressive and cinematic, with viroperception joining the track to sharpen the apocalyptic pressure. It works for fans who want anime/game-inspired rap with teeth: loud, destructive, and built for edits, gym clips, and villain-mode moments."
  },
  {
    title: "Numerical",
    slug: "numerical",
    publicLongDescription:
      `"Numerical" is vvviruz turning numbers into a punchline structure. The track is less about counting for the sake of it and more about stacking confidence, wordplay, and flexes in a way that makes the title feel like the engine of the song.\n\n` +
      "The energy is playful but competitive, sitting in the proof-of-skill lane. It is a sharp record for listeners who like technical setups, quick switches, and a rapper treating a simple concept like a challenge."
  },
  {
    title: "Beast Mode",
    slug: "beast-mode",
    publicLongDescription:
      `"Beast Mode" is built for the moment before the work gets heavy: early mornings, discipline, headphones in, and no room for excuses. The record blends bilingual EN/FR energy with a gym-focused power-up feel.\n\n` +
      "With MK243 featured, the track moves like a workout anthem and a transformation record at the same time. It is made for lifting sessions, AMVs, Monster-coded edits, and any moment where the goal is to lock in and push past normal."
  },
  {
    title: "Multiversus 3: HIT - John Wick vs. Sakamoto",
    slug: "multiversus-3-hit-john-wick-vs-sakamoto",
    publicLongDescription:
      `"Multiversus 3: HIT - John Wick vs. Sakamoto" imagines a rap battle between John Wick and Taro Sakamoto, built around assassin precision and target-list pressure. The hook keeps the word "hit" moving between violence, accuracy, and song impact.\n\n` +
      "As part of the Multiversus series, the track is made for fans who enjoy matchup logic as much as bars. With @954mari featured, it leans into action-scene energy, clean punchlines, and the feeling of two deadly worlds crossing paths."
  },
  {
    title: "Tyrant (Freestyle)",
    slug: "tyrant-(freestyle)-2c260c30",
    publicLongDescription:
      `"Tyrant (Freestyle)" is a high-energy record about turning frustration into control. Inspired by Kanye's "Power," it uses chaos, isolation, and self-doubt as fuel instead of as an excuse to fold.\n\n` +
      "The record sits in a darker confidence lane: aggressive, direct, and built around the feeling of taking the reins back. It is for moments when growth does not feel peaceful; it feels like deciding no one else gets to drive."
  },
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
  },
  {
    title: "Lover Still",
    slug: "lover-still-e5cfed16",
    publicLongDescription:
      `"Lover Still" continues the Lover Boy energy with a more settled, intentional view of romance. It is about choosing patience and commitment in a world where love can feel temporary or hard to trust.\n\n` +
      "The song keeps the bilingual-leaning softness of the series while making the message more grown: love as pursuit, discipline, and clarity. It fits late-night reflection, relationship edits, and anyone who hears romance as something to build, not just chase."
  },
  {
    title: "Arrive",
    slug: "arrive",
    publicLongDescription:
      `"Arrive" is a French-inspired arrival record about destiny, timing, and stepping into the moment. Inspired by D.ACE influences like "Carrive" and "C'est le moment," the track treats arrival as something earned, not handed over.\n\n` +
      "With Jusniz featured, the song brings bilingual momentum and a project-opener kind of confidence. It belongs in the Massive Imitation lane because it borrows familiar energy, then redirects it into vvviruz's own promise: this is not waiting around, this is showing up."
  },
  {
    title: "Switch 2 (Deja Vu)",
    slug: "switch-2-deja-vu",
    publicLongDescription:
      `"Switch 2 (Deja Vu)" is a trilingual flex record that moves through English, French, and Spanish while playing with repetition, growth, and the feeling of reliving a moment from a higher level. It pulls from familiar French rap references and reshapes them into a modern vvviruz performance.\n\n` +
      "As part of both the Switch Series and Massive Imitation, the song is about range: language shifts, flow changes, and cultural signals moving in the same track. It is built for fans who like multilingual bars, nostalgia with a new edge, and records that feel like the artist is switching gears in real time."
  },
  {
    title: "Jeep (Freestyle)",
    slug: "jeep-(freestyle)-93c7b7be",
    publicLongDescription:
      `"Jeep (Freestyle)" reinterprets Token's "Jeep" through vvviruz's more chaotic, self-aware lens. The freestyle plays with high-life imagery, temptation, and the uncomfortable feeling of chasing something that may not actually fit who you are.\n\n` +
      "The energy is unpredictable and introspective without losing bite. It is a record for listeners who like flexes with cracks in them: bilingual flashes, sharp wordplay, and the sound of vvviruz testing what freedom really means."
  },
  {
    title: "Shibuya",
    slug: "shibuya-591d8f73",
    publicLongDescription:
      `"Shibuya" is a Jujutsu Kaisen-inspired nerdcore record built around the chaos of the Shibuya Incident arc. The track pulls from characters, fights, and domain-expansion energy without slowing down to overexplain the references.\n\n` +
      "With Jamar Rose featured, the song hits like an anime battle edit: aggressive delivery, trilingual bars, and controlled destruction over a hard trap/drill pulse. It is for fans who want the room to feel like it just entered a cursed zone."
  },
  {
    title: "Stronger",
    slug: "stronger-5ea33bce",
    publicLongDescription:
      `"Stronger" is a dark nerdcore track inspired by Akaza from Demon Slayer, focused on loss, purpose, and the cost of chasing power. The song treats strength as both survival and obsession, which gives the aggression a more emotional center.\n\n` +
      "The delivery is intense and driven, built for listeners who connect with character studies that are not just about winning fights. It is a power-up record with grief underneath it: training, revenge, and the pressure to become something harder than pain."
  },
  {
    title: "Visions",
    slug: "visions-c1443bce",
    publicLongDescription:
      `"Visions" looks at internal pressure through the lens of Vigilante Deku from My Hero Academia. The song focuses on mental strain, responsibility, and the weight of seeing too much while still trying to do the right thing.\n\n` +
      "Instead of turning the character into a simple hero anthem, vvviruz leans into the anxiety and isolation behind the power. It is a darker reflective nerdcore record for fans who connect with the emotional side of anime, not just the fights."
  },
  {
    title: "Multiversus: Bloody - Alucard vs. Muzan",
    slug: "multiversus-bloody--alucard-vs.-muzan-a599bdb6",
    publicLongDescription:
      `"Multiversus: Bloody - Alucard vs. Muzan" turns vampire and demon royalty into a blood-soaked rap battle. The matchup pulls from Castlevania and Demon Slayer, with the energy of old monsters arguing over legacy, power, and who really deserves fear.\n\n` +
      "As part of the Multiversus series, the track is built around fan debate and character contrast. It is aggressive, theatrical, and made for listeners who want references, threats, and battle-rap tension packed into one dark matchup."
  },
  {
    title: "Stay",
    slug: "stay",
    publicLongDescription:
      `"Stay" is a late-summer heartbreak record about wanting someone close while knowing distance may already be winning. It blends drill-inspired production with a softer loverboy vocal approach, keeping the emotion vulnerable without turning fragile.\n\n` +
      "The song sits in the space between confession and restraint: wanting to say more, hoping the other person understands, and holding onto a moment before it leaves. It is for late drives, quiet nights, and anyone who has wanted someone to stay without knowing how to make that happen."
  },
  {
    title: "Multiversus: King - Meruem vs. Beru",
    slug: "multiversus-king--meruem-vs.-beru-81d5b7fa",
    publicLongDescription:
      `"Multiversus: King - Meruem vs. Beru" imagines a battle between two ant kings: Meruem from Hunter x Hunter and Beru from Solo Leveling. The record centers on crown energy, instinct, loyalty, and what it means to be called king even when the throne looks different.\n\n` +
      "As an early Multiversus entry, it sets the tone for matchup-based nerdcore from vvviruz: character logic, power scaling, and battle-rap framing all in one. It is made for fans who enjoy anime debates that turn into music instead of comment sections."
  },
  {
    title: "Switch",
    slug: "switch",
    publicLongDescription:
      `"Switch" introduces the Switch Series with bilingual EN/FR performance energy and a focus on quick handoffs between voices. The song feels like a plan being called in real time: move fast, change angles, and keep the pressure on.\n\n` +
      "With MK243 and Jusniz featured, the record is about momentum and chemistry. It works as a launch point for the series because the concept is built into the sound itself: different performers, different languages, same mission."
  },
  {
    title: "Covid 19 (Freestyle)",
    slug: "covid-19-(freestyle)-c35c9cc7",
    publicLongDescription:
      `"Covid 19 (Freestyle)" is a time-capsule freestyle from the chaos of the pandemic era. It mixes humor, frustration, and sharp references to capture what 2020 felt like when the outside world suddenly became dangerous and everyone was stuck watching it unfold.\n\n` +
      "The record is hard-hitting but nostalgic now, showing vvviruz using the moment's absurdity as rap material. It is for listeners who remember the lockdown energy: restless, online, anxious, and still finding ways to joke through it."
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
