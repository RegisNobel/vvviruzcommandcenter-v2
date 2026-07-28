"use server";

import {revalidatePath, revalidateTag} from "next/cache";
import {redirect} from "next/navigation";

import {requireAuthenticatedAdminSession} from "@/lib/auth/server";
import {normalizeAdminError} from "@/lib/server/admin-error-response";
import {
  createFanUpdate,
  createVaultItem,
  deleteFanContent,
  PUBLIC_LATEST_INTEL_CACHE_TAG,
  setVaultItemStatus,
  setFanUpdatePublished,
  updateVaultItem,
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

async function performFanContentAction(
  context: string,
  fallbackMessage: string,
  successMessage: string,
  operation: () => Promise<void>
) {
  try {
    await requireAuthenticatedAdminSession();
    await operation();
  } catch (error) {
    const {payload} = normalizeAdminError(error, {
      context,
      fallbackMessage,
      exposeMessage: true
    });
    redirect(
      `/admin/fan-content?error=${encodeURIComponent(payload.message)}&requestId=${encodeURIComponent(payload.requestId || "")}`
    );
  }

  done(successMessage);
}

export async function createFanUpdateAction(formData: FormData) {
  await performFanContentAction(
    "fan-content.intel.create",
    "The Latest Intel entry could not be saved.",
    "Latest Intel entry saved.",
    async () => {
      await createFanUpdate({releaseId: value(formData, "releaseId"), type: value(formData, "type"), title: value(formData, "title"), summary: value(formData, "summary"), href: value(formData, "href"), isPublished: checked(formData, "isPublished")});
    }
  );
}

export async function updateFanUpdateAction(formData: FormData) {
  await performFanContentAction(
    "fan-content.intel.update",
    "The Latest Intel entry could not be updated.",
    "Latest Intel entry updated.",
    async () => {
      await updateFanUpdate({
        id: value(formData, "id"),
        releaseId: value(formData, "releaseId"),
        type: value(formData, "type"),
        title: value(formData, "title"),
        summary: value(formData, "summary"),
        href: value(formData, "href")
      });
    }
  );
}

export async function setFanUpdatePublicationAction(formData: FormData) {
  const shouldPublish = value(formData, "publicationAction") === "publish";
  await performFanContentAction(
    "fan-content.intel.publication",
    `The Latest Intel entry could not be ${shouldPublish ? "published" : "unpublished"}.`,
    shouldPublish ? "Latest Intel entry published." : "Latest Intel entry unpublished.",
    async () => {
      await setFanUpdatePublished(value(formData, "id"), shouldPublish);
    }
  );
}

export async function createVaultItemAction(formData: FormData) {
  await performFanContentAction(
    "fan-content.vault.create",
    "The Vault item could not be saved.",
    "Vault item saved.",
    async () => {
      await createVaultItem({releaseId: value(formData, "releaseId"), title: value(formData, "title"), slug: value(formData, "slug"), itemType: value(formData, "itemType"), description: value(formData, "description"), coverArtUrl: value(formData, "coverArtUrl"), previewUrl: value(formData, "previewUrl"), priceLabel: value(formData, "priceLabel"), checkoutUrl: value(formData, "checkoutUrl"), status: value(formData, "status"), sortOrder: Number(value(formData, "sortOrder")) || 0});
    }
  );
}

export async function updateVaultItemAction(formData: FormData) {
  await performFanContentAction(
    "fan-content.vault.update",
    "The Vault item could not be updated.",
    "Vault item updated.",
    async () => {
      await updateVaultItem(value(formData, "id"), {
        releaseId: value(formData, "releaseId"),
        title: value(formData, "title"),
        slug: value(formData, "slug"),
        itemType: value(formData, "itemType"),
        description: value(formData, "description"),
        coverArtUrl: value(formData, "coverArtUrl"),
        previewUrl: value(formData, "previewUrl"),
        priceLabel: value(formData, "priceLabel"),
        checkoutUrl: value(formData, "checkoutUrl"),
        status: value(formData, "status"),
        sortOrder: Number(value(formData, "sortOrder")) || 0
      });
    }
  );
}

export async function setVaultItemStatusAction(formData: FormData) {
  const status = value(formData, "status");
  const successMessage =
    status === "archived"
      ? "Vault item archived. Its public checkout is now hidden."
      : status === "public"
        ? "Vault item published."
        : "Vault item restored to Draft.";
  await performFanContentAction(
    "fan-content.vault.status",
    "The Vault item status could not be changed.",
    successMessage,
    async () => {
      await setVaultItemStatus(value(formData, "id"), status);
    }
  );
}

export async function deleteFanContentAction(formData: FormData) {
  await performFanContentAction(
    "fan-content.delete",
    "The content could not be removed.",
    "Content removed.",
    async () => {
      await deleteFanContent(value(formData, "kind"), value(formData, "id"));
    }
  );
}
