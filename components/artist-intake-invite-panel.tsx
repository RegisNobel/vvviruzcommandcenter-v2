"use client";

import {Check, Copy, Link2, Plus} from "lucide-react";
import {useState} from "react";

import {createArtistIntakeInviteAction} from "@/app/admin/(protected)/artists/actions";

export function ArtistIntakeInvitePanel() {
  const [artistName, setArtistName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [invitePath, setInvitePath] = useState("");
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullUrl =
    invitePath && typeof window !== "undefined"
      ? `${window.location.origin}${invitePath}`
      : invitePath;

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setMessage("");
    setInvitePath("");
    setCopied(false);
    const result = await createArtistIntakeInviteAction({
      artistName,
      inviteeEmail,
      expiresInDays: Number(expiresInDays)
    });
    setIsCreating(false);
    if (!result.ok || !result.data) {
      setMessage(result.message || "The artist intake invitation could not be created.");
      return;
    }
    setInvitePath(result.data.path);
    setMessage(
      "Invitation created. Copy this private link now; only its secure hash is stored."
    );
  }

  async function copyInvite() {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
  }

  return (
    <section className="command-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Link2 className="text-brand-primary" size={17} />
        <h2 className="text-lg font-semibold text-ink">Create private intake</h2>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Generate an invite before creating the managed artist record. The raw
        submission remains separate until you review it.
      </p>
      <form
        className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_130px_auto]"
        onSubmit={createInvite}
      >
        <label className="space-y-2">
          <span className="field-label">Artist name</span>
          <input
            className="field-input"
            onChange={(event) => setArtistName(event.target.value)}
            required
            value={artistName}
          />
        </label>
        <label className="space-y-2">
          <span className="field-label">Collaborator email</span>
          <input
            className="field-input"
            onChange={(event) => setInviteeEmail(event.target.value)}
            required
            type="email"
            value={inviteeEmail}
          />
        </label>
        <label className="space-y-2">
          <span className="field-label">Expires</span>
          <select
            className="field-input"
            onChange={(event) => setExpiresInDays(event.target.value)}
            value={expiresInDays}
          >
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
          </select>
        </label>
        <button
          className="action-button-primary self-end"
          disabled={isCreating}
          type="submit"
        >
          <Plus size={15} />
          {isCreating ? "Creating..." : "Create link"}
        </button>
      </form>

      {message ? (
        <div
          className={`mt-5 ${
            invitePath ? "state-panel-success" : "state-panel-danger"
          }`}
        >
          <p>{message}</p>
          {invitePath ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="field-input min-w-0 flex-1 font-mono text-xs"
                readOnly
                value={fullUrl}
              />
              <button
                className="action-button-secondary"
                onClick={() => void copyInvite()}
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
