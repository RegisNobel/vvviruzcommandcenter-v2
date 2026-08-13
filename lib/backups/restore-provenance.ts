export type SnapshotRecord = Record<string, unknown> & {id?: string};

export type RestoreProvenanceWarning = {
  code: "MISSING_ADMIN_ACTOR_REFERENCE";
  model: string;
  recordIndex: number;
  field: string;
};

type AdminLookupClient = {
  adminUser: {
    findMany(args: {where: {id: {in: string[]}}; select: {id: true}}): Promise<Array<{id: string}>>;
  };
};

/**
 * Keep audit/provenance foreign keys when their AdminUser exists in the target.
 * Missing actors are the only compatibility case that becomes null, and every
 * such transformation produces a field-specific warning without exposing the
 * missing identifier or any row payload.
 */
export async function preserveKnownAdminReferences(
  client: AdminLookupClient,
  model: string,
  records: SnapshotRecord[] = [],
  fields: string[],
  warnings: RestoreProvenanceWarning[]
) {
  const referencedIds = [...new Set(records.flatMap((record) =>
    fields.map((field) => record[field]).filter((value): value is string => typeof value === "string" && value.length > 0)
  ))];
  const knownIds = new Set(
    referencedIds.length === 0
      ? []
      : (await client.adminUser.findMany({where: {id: {in: referencedIds}}, select: {id: true}})).map((row) => row.id)
  );

  return records.map((record, recordIndex) => {
    const resolved = {...record};
    for (const field of fields) {
      const value = record[field];
      if (typeof value !== "string" || value.length === 0 || knownIds.has(value)) continue;
      resolved[field] = null;
      warnings.push({
        code: "MISSING_ADMIN_ACTOR_REFERENCE",
        model,
        recordIndex,
        field
      });
    }
    return resolved;
  });
}
