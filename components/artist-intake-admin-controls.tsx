"use client";

import {Check, Copy, ExternalLink, RefreshCw} from "lucide-react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {
  archiveArtistIntakeAction,
  convertArtistIntakeToDraftAction,
  markArtistIntakeReviewedAction,
  reopenArtistIntakeAction,
  rotateArtistIntakeInviteAction
} from "@/app/admin/(protected)/artists/actions";

export function ArtistIntakeAdminControls({
  artistName,
  id,
  linkedArtistProfileId,
  status
}: {
  artistName: string;
  id: string;
  linkedArtistProfileId: string | null;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function markReviewed() {
    setBusy("review");
    setMessage("");
    const result = await markArtistIntakeReviewedAction(id);
    setBusy("");
    setMessage(
      result.ok ? "Intake marked reviewed." : result.message
    );
    if (result.ok) router.refresh();
  }

  async function convertToDraft() {
    if (
      !window.confirm(
        `Create an unpublished managed-artist draft for ${artistName} from this reviewed intake?`
      )
    ) {
      return;
    }
    setBusy("convert");
    setMessage("");
    const result = await convertArtistIntakeToDraftAction(id);
    setBusy("");
    if (!result.ok || !result.data) {
      setMessage(result.message || "The draft could not be created.");
      return;
    }
    router.push(`/admin/artists/${result.data.artistProfileId}`);
  }

  async function reopen() {
    if (
      !window.confirm(
        `Reopen ${artistName}'s intake for editing for another 30 days?`
      )
    ) {
      return;
    }
    setBusy("reopen");
    setMessage("");
    const result = await reopenArtistIntakeAction(id);
    setBusy("");
    setMessage(result.ok ? "Intake reopened." : result.message);
    if (result.ok) router.refresh();
  }

  async function regenerate() {
    if (
      !window.confirm(
        "Regenerate this invitation? The previous private link will stop working."
      )
    ) {
      return;
    }
    setBusy("regenerate");
    setMessage("");
    setInviteUrl("");
    setCopied(false);
    const result = await rotateArtistIntakeInviteAction(id);
    setBusy("");
    if (!result.ok || !result.data) {
      setMessage(result.message || "The invitation could not be regenerated.");
      return;
    }
    setInviteUrl(new URL(result.data.path, window.location.origin).toString());
    setMessage(
      "New private link created. Copy it now; only its secure hash is stored."
    );
    router.refresh();
  }

  async function archive() {
    if (
      !window.confirm(
        linkedArtistProfileId
          ? `Archive this intake? The linked ${artistName} draft and its retained assets will not be deleted.`
          : `Archive this intake? Unused uploaded images associated with it will be deleted.`
      )
    ) {
      return;
    }
    setBusy("archive");
    setMessage("");
    const result = await archiveArtistIntakeAction(id);
    setBusy("");
    setMessage(result.ok ? "Intake archived." : result.message);
    if (result.ok) router.refresh();
  }

  return (
    <section className="command-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="field-label">Pipeline actions</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            Move this intake deliberately
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Conversion creates editable, unpublished artist and release drafts.
            Nothing here publishes public content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "SUBMITTED" ? (
            <button
              className="action-button-primary"
              disabled={Boolean(busy)}
              onClick={() => void markReviewed()}
              type="button"
            >
              {busy === "review" ? "Marking..." : "Mark reviewed"}
            </button>
          ) : null}
          {status === "REVIEWED" ? (
            <button
              className="action-button-primary"
              disabled={Boolean(busy)}
              onClick={() => void convertToDraft()}
              type="button"
            >
              {busy === "convert" ? "Creating..." : "Create reviewed artist draft"}
            </button>
          ) : null}
          {linkedArtistProfileId ? (
            <Link
              className="action-button-primary"
              href={`/admin/artists/${linkedArtistProfileId}`}
            >
              Open artist draft
              <ExternalLink size={15} />
            </Link>
          ) : null}
          {["SUBMITTED", "REVIEWED", "EXPIRED"].includes(status) &&
          !linkedArtistProfileId ? (
            <button
              className="action-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => void reopen()}
              type="button"
            >
              {busy === "reopen" ? "Reopening..." : "Reopen for corrections"}
            </button>
          ) : null}
          {status === "DRAFT" && !linkedArtistProfileId ? (
            <button
              className="action-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => void regenerate()}
              type="button"
            >
              <RefreshCw size={15} />
              {busy === "regenerate" ? "Regenerating..." : "Regenerate link"}
            </button>
          ) : null}
          {status !== "ARCHIVED" ? (
            <button
              className="action-button-secondary"
              disabled={Boolean(busy)}
              onClick={() => void archive()}
              type="button"
            >
              {busy === "archive" ? "Archiving..." : "Archive intake"}
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="mt-5 rounded-md border border-edge bg-input px-4 py-3 text-sm text-secondary">
          <p>{message}</p>
          {inviteUrl ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="field-input min-w-0 flex-1 font-mono text-xs"
                readOnly
                value={inviteUrl}
              />
              <button
                className="action-button-secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                }}
                type="button"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
