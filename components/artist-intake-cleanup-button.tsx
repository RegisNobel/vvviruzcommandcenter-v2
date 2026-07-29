"use client";

import {Trash2} from "lucide-react";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {archiveExpiredArtistIntakesAction} from "@/app/admin/(protected)/artists/actions";

export function ArtistIntakeCleanupButton({count}: {count: number}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!count && !message) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {count ? (
        <button
          className="action-button-secondary"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                `Archive ${count} expired intake${count === 1 ? "" : "s"} and delete their unused uploaded images?`
              )
            ) {
              return;
            }
            setBusy(true);
            setMessage("");
            const result = await archiveExpiredArtistIntakesAction();
            setBusy(false);
            setMessage(
              result.ok && result.data
                ? `${result.data.count} expired intake${result.data.count === 1 ? "" : "s"} archived.`
                : result.message || "Expired intakes could not be archived."
            );
            if (result.ok) router.refresh();
          }}
          type="button"
        >
          <Trash2 size={15} />
          {busy ? "Cleaning..." : `Clean up ${count} expired`}
        </button>
      ) : null}
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
