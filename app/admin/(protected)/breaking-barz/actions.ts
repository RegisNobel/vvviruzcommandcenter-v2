"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

import {requireAuthenticatedAdminSession} from "@/lib/auth/server";
import {
  reviewBreakingBarzSubmission,
  saveExternalBreakingBarzEntry,
  type BreakingBarzEditorInput
} from "@/lib/repositories/breaking-barz";
import {normalizeAdminError} from "@/lib/server/admin-error-response";

function value(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function editorInput(formData: FormData): BreakingBarzEditorInput {
  return {
    id: value(formData, "id") || undefined,
    songTitle: value(formData, "songTitle"),
    artistNames: value(formData, "artistNames").split(","),
    lyricExcerpt: value(formData, "lyricExcerpt"),
    summary: value(formData, "summary"),
    breakdown: value(formData, "breakdown"),
    verificationStatus: value(formData, "verificationStatus"),
    verificationNote: value(formData, "verificationNote"),
    categorySlugs: formData.getAll("categorySlugs").map(String),
    spotifyUrl: value(formData, "spotifyUrl"),
    appleMusicUrl: value(formData, "appleMusicUrl"),
    youtubeUrl: value(formData, "youtubeUrl"),
    sources: value(formData, "sources")
      .split(/\r?\n/)
      .map((line) => {
        const [label, ...url] = line.split("|");
        return {label: label?.trim() || "Source", url: url.join("|").trim()};
      })
      .filter((source) => source.url),
    action: (["draft", "publish", "archive", "withdraw"].includes(value(formData, "action"))
      ? value(formData, "action")
      : "draft") as BreakingBarzEditorInput["action"]
  };
}

function done(message: string) {
  revalidatePath("/breaking-barz");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/breaking-barz");
  redirect(`/admin/breaking-barz?message=${encodeURIComponent(message)}`);
}

async function perform(context: string, success: string, operation: () => Promise<void>) {
  try {
    await requireAuthenticatedAdminSession();
    await operation();
  } catch (error) {
    const {payload} = normalizeAdminError(error, {
      context,
      fallbackMessage: "Breaking Barz could not be updated.",
      exposeMessage: true
    });
    redirect(`/admin/breaking-barz?error=${encodeURIComponent(payload.message)}`);
  }
  done(success);
}

export async function saveBreakingBarzEntryAction(formData: FormData) {
  const input = editorInput(formData);
  await perform("breaking-barz.entry.save", input.action === "publish" ? "Entry published." : "Entry saved.", async () => {
    await saveExternalBreakingBarzEntry(input);
  });
}

export async function rejectBreakingBarzSubmissionAction(formData: FormData) {
  await perform("breaking-barz.submission.reject", "Suggestion rejected.", async () => {
    await reviewBreakingBarzSubmission({
      id: value(formData, "submissionId"),
      action: "reject",
      reviewNote: value(formData, "reviewNote")
    });
  });
}

export async function publishBreakingBarzSubmissionAction(formData: FormData) {
  await perform("breaking-barz.submission.publish", "Suggestion approved and published.", async () => {
    await reviewBreakingBarzSubmission({
      id: value(formData, "submissionId"),
      action: "publish",
      reviewNote: value(formData, "reviewNote"),
      entry: editorInput(formData)
    });
  });
}
