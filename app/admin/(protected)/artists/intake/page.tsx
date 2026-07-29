import Link from "next/link";

import {ArtistIntakeCleanupButton} from "@/components/artist-intake-cleanup-button";
import {ArtistIntakeInvitePanel} from "@/components/artist-intake-invite-panel";
import {listArtistIntakes} from "@/lib/repositories/artist-intakes";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (["SUBMITTED", "REVIEWED", "CONVERTED"].includes(status)) {
    return "status-badge-ready";
  }
  if (status === "EXPIRED") return "status-badge-warning";
  return "status-badge-neutral";
}

export default async function ArtistIntakeAdminPage() {
  const intakes = await listArtistIntakes();

  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-sm font-semibold text-muted hover:text-ink"
          href="/admin/artists"
        >
          ← Artists
        </Link>
        <p className="field-label mt-5">Managed artist pipeline</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Artist intake</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Invite collaborators, monitor draft progress, and review submitted source
          material before building a managed profile.
        </p>
      </header>

      <ArtistIntakeInvitePanel />

      <section className="command-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-4">
          <h2 className="font-semibold text-ink">Invitations and submissions</h2>
          <ArtistIntakeCleanupButton
            count={intakes.filter((intake) => intake.status === "EXPIRED").length}
          />
        </div>
        {intakes.length ? (
          <div className="divide-y divide-edge">
            {intakes.map((intake) => (
              <Link
                className="grid gap-3 px-5 py-5 transition hover:bg-surface-hover sm:grid-cols-[1fr_auto] sm:items-center"
                href={`/admin/artists/intake/${intake.id}`}
                key={intake.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{intake.artistName}</h3>
                    <span className={statusClass(intake.status)}>
                      {intake.status}
                    </span>
                    {["FAILED", "NOT_CONFIGURED"].includes(
                      intake.submissionNotificationStatus
                    ) ? (
                      <span className="status-badge-warning">
                        NOTIFICATION NEEDS ATTENTION
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {intake.inviteeEmail} · token …{intake.tokenHint}
                  </p>
                </div>
                <div className="text-left text-xs leading-5 text-muted sm:text-right">
                  <p>Created {formatDate(intake.createdAt)}</p>
                  <p>
                    {intake.submittedAt
                      ? `Submitted ${formatDate(intake.submittedAt)}`
                      : `Expires ${formatDate(intake.expiresAt)}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-semibold text-ink">No artist intakes yet.</p>
            <p className="mt-2 text-sm text-muted">
              Generate the first private invitation above.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
