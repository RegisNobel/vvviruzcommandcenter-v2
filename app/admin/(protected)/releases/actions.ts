"use server";

import {revalidatePath} from "next/cache";

import {runOperationalHealthChecks} from "@/lib/repositories/operational-health";

export async function refreshOperationalHealthAction() {
  await runOperationalHealthChecks();
  revalidatePath("/admin/releases");
}
