import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {Prisma, PrismaClient} from "@prisma/client";

async function main() {
  const directory = process.env.BACKUP_REPAIR_DIRECTORY!;
  const target = `file:${path.join(directory, "restore.db").replace(/\\/g, "/")}`;
  assert.equal(process.env.DATABASE_URL, target);
  assert.equal(process.env.DIRECT_URL, target);
  assert.equal(process.env.ALLOW_DATABASE_URL_OVERRIDE, "1");
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
  const client = new PrismaClient();
  try {
    let tables = 0, records = 0;
    for (const [table, count] of Object.entries(manifest.recordCounts) as [string, number][]) {
      const model = Prisma.dmmf.datamodel.models.find(m => {
        const key = m.name[0].toLowerCase() + m.name.slice(1);
        return table === key || table === `${key}s` || table === `${key.slice(0, -1)}ies`;
      });
      assert.ok(model, `No restore model for ${table}`);
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      const actual = await (client as unknown as Record<string, {count: () => Promise<number>}>)[delegate].count();
      assert.equal(actual, count, `Restored count mismatch: ${table}`);
      tables++; records += count;
    }
    await fs.writeFile(path.join(directory, "restore-passed"), "verified", {mode: 0o600});
    console.log(JSON.stringify({backupRepair: "disposable-restore-passed", tables, records, runId: manifest.runId}));
  } finally {await client.$disconnect();}
}
void main().catch(error => {console.error(error instanceof Error ? error.message : "Restore verification failed."); process.exitCode = 1;});
