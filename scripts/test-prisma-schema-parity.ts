import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sqliteSchemaPath = path.join(projectRoot, "prisma", "schema.prisma");
const postgresSchemaPath = path.join(projectRoot, "prisma", "schema.postgres.prisma");

function readSchema(schemaPath: string) {
  return fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, "");
}

function readDatasourceBlock(schema: string) {
  const match = schema.match(/datasource\s+db\s*\{([\s\S]*?)\}/);
  assert(match, "Expected a datasource db block.");
  return match[1];
}

function datasourceProvider(schema: string) {
  const block = readDatasourceBlock(schema);
  const match = block.match(/provider\s*=\s*"([^"]+)"/);
  assert(match, "Expected datasource db to declare a provider.");
  return match[1];
}

function hasDirectUrl(schema: string) {
  return /^\s*directUrl\s*=/m.test(readDatasourceBlock(schema));
}

function removeDatasourceBlock(schema: string) {
  const lines = schema.split(/\r?\n/);
  const output: string[] = [];
  let skipping = false;
  let braceDepth = 0;

  for (const line of lines) {
    if (!skipping && /^\s*datasource\s+db\s*\{/.test(line)) {
      skipping = true;
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    if (skipping) {
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth === 0) {
        skipping = false;
      }
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function normalizeLogicalSchema(schema: string) {
  return removeDatasourceBlock(schema)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
}

const sqliteSchema = readSchema(sqliteSchemaPath);
const postgresSchema = readSchema(postgresSchemaPath);

assert.equal(datasourceProvider(sqliteSchema), "sqlite");
assert.equal(datasourceProvider(postgresSchema), "postgresql");
assert.equal(hasDirectUrl(sqliteSchema), false, "SQLite must not require DIRECT_URL.");
assert.equal(hasDirectUrl(postgresSchema), true, "PostgreSQL must retain its non-pooling DIRECT_URL.");
assert.equal(
  normalizeLogicalSchema(postgresSchema),
  normalizeLogicalSchema(sqliteSchema),
  "SQLite and PostgreSQL Prisma schemas differ outside their allowed datasource configuration."
);

console.log("Prisma schemas are logically aligned; only the approved datasource differences remain.");
