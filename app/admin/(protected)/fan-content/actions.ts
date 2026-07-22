"use server";

import {revalidatePath, revalidateTag} from "next/cache";
import {redirect} from "next/navigation";

import {requireAuthenticatedAdminSession} from "@/lib/auth/server";
import {
  createFanUpdate,
  createVaultItem,
  deleteFanContent,
  PUBLIC_LATEST_INTEL_CACHE_TAG,
  setFanUpdatePublished,
  updateFanUpdate
} from "@/lib/repositories/fan-content";

function value(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}
function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}
function done(message: string) {
  revalidateTag(PUBLIC_LATEST_INTEL_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/vault");
  revalidatePath("/admin/fan-content");
  redirect(`/admin/fan-content?message=${encodeURIComponent(message)}`);
}

export async function createFanUpdateAction(formData: FormData) {
  await requireAuthenticatedAdminSession();
  await createFanUpdate({releaseId: value(formData, "releaseId"), type: value(formData, "type"), title: value(formData, "title"), summary: value(formData, "summary"), href: value(formData, "href"), isPublished: checked(formData, "isPublished")});
  done("Latest Intel entry saved.");
}

export async function updateFanUpdateAction(formData: FormData) {
  await requireAuthenticatedAdminSession();
  await updateFanUpdate({
    id: value(formData, "id"),
    releaseId: value(formData, "releaseId"),
    type: value(formData, "type"),
    title: value(formData, "title"),
    summary: value(formData, "summary"),
    href: value(formData, "href")
  });
  done("Latest Intel entry updated.");
}

export async function setFanUpdatePublicationAction(formData: FormData) {
  await requireAuthenticatedAdminSession();
  const shouldPublish = value(formData, "publicationAction") === "publish";
  await setFanUpdatePublished(value(formData, "id"), shouldPublish);
  done(shouldPublish ? "Latest Intel entry published." : "Latest Intel entry unpublished.");
}

export async function createVaultItemAction(formData: FormData) {
  await requireAuthenticatedAdminSession();
  await createVaultItem({releaseId: value(formData, "releaseId"), title: value(formData, "title"), slug: value(formData, "slug"), itemType: value(formData, "itemType"), description: value(formData, "description"), coverArtUrl: value(formData, "coverArtUrl"), previewUrl: value(formData, "previewUrl"), priceLabel: value(formData, "priceLabel"), checkoutUrl: value(formData, "checkoutUrl"), status: value(formData, "status")});
  done("Vault item saved.");
}

export async function deleteFanContentAction(formData: FormData) {
  await requireAuthenticatedAdminSession();
  await deleteFanContent(value(formData, "kind"), value(formData, "id"));
  done("Content removed.");
}
