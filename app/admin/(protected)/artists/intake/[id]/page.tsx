import Link from "next/link";
import {notFound} from "next/navigation";

import {ArtistIntakeAdminControls} from "@/components/artist-intake-admin-controls";
import {readArtistIntakeForAdmin} from "@/lib/repositories/artist-intakes";
import {getCountryName} from "@/lib/countries";
import {ARTIST_THEME_FAMILIES} from "@/lib/artist-profiles";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function TextBlock({children}: {children: string}) {
  return children ? (
    <p className="whitespace-pre-wrap text-sm leading-7 text-secondary">{children}</p>
  ) : (
    <p className="text-sm italic text-muted">Not provided</p>
  );
}

function MetaItem({label, value}: {label: string; value: string}) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-6 text-secondary">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

export default async function ArtistIntakeReviewPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = await params;
  const intake = await readArtistIntakeForAdmin(id);
  if (!intake) notFound();

  const response = intake.response;
  const themeLabel =
    ARTIST_THEME_FAMILIES.find(
      (theme) => theme.value === response.artist.themeFamily
    )?.label || response.artist.themeFamily;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            className="text-sm font-semibold text-muted hover:text-ink"
            href="/admin/artists/intake"
          >
            ← Artist intake
          </Link>
          <p className="field-label mt-5">Raw collaborator submission</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">
            {intake.artistName}
          </h1>
          <p className="mt-2 text-sm text-muted">{intake.inviteeEmail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={
              intake.status === "SUBMITTED"
                ? "status-badge-ready"
                : intake.status === "EXPIRED"
                  ? "status-badge-warning"
                  : "status-badge-neutral"
            }
          >
            {intake.status}
          </span>
          {intake.linkedArtistProfileId ? (
            <Link
              className="action-button-primary"
              href={`/admin/artists/${intake.linkedArtistProfileId}`}
            >
              Open artist draft
            </Link>
          ) : null}
        </div>
      </header>

      <section className="state-panel-warning">
        This is source material, not public copy. Review and shape it in the
        managed artist editor; do not paste it into the public profile unchanged
        unless that is an intentional editorial decision.
      </section>

      <ArtistIntakeAdminControls
        artistName={intake.artistName}
        id={intake.id}
        linkedArtistProfileId={intake.linkedArtistProfileId}
        status={intake.status}
      />

      {["FAILED", "NOT_CONFIGURED"].includes(
        intake.submissionNotificationStatus
      ) ? (
        <section className="state-panel-danger">
          <p className="font-semibold">Submission notification was not delivered.</p>
          <p className="mt-1 text-sm">
            {intake.submissionNotificationError ||
              "Review the command-center email configuration."}
          </p>
        </section>
      ) : null}

      <section className="command-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Intake activity</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem label="Created" value={formatDate(intake.createdAt)} />
          <MetaItem label="Last opened" value={formatDate(intake.lastOpenedAt)} />
          <MetaItem label="Submitted" value={formatDate(intake.submittedAt)} />
          <MetaItem label="Reviewed" value={formatDate(intake.reviewedAt)} />
          <MetaItem label="Converted" value={formatDate(intake.convertedAt)} />
          <MetaItem
            label="Notification"
            value={intake.submissionNotificationStatus.replaceAll("_", " ")}
          />
          <MetaItem label="Expires" value={formatDate(intake.expiresAt)} />
        </dl>
      </section>

      <section className="command-surface p-5 sm:p-6">
        <p className="field-label">Artist foundation</p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem label="Display name" value={response.artist.displayName} />
          <MetaItem
            label="Public country"
            value={getCountryName(response.artist.countryCode) || response.artist.countryCode}
          />
          <MetaItem label="Theme preference" value={themeLabel} />
          <MetaItem
            label="Primary genres"
            value={response.artist.genres.join(", ")}
          />
          <MetaItem
            label="Profile image"
            value={response.artist.profileImageUrl}
          />
          <MetaItem
            label="Image permission"
            value={response.artist.imageRightsConfirmed ? "Confirmed" : "Not confirmed"}
          />
          <MetaItem
            label="Image description"
            value={response.artist.profileImageAlt}
          />
        </dl>
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="field-label">How they describe their sound</p>
            <div className="mt-3">
              <TextBlock>{response.artist.soundDescription}</TextBlock>
            </div>
          </div>
          <div>
            <p className="field-label">What makes the work distinct</p>
            <div className="mt-3">
              <TextBlock>{response.artist.differentiator}</TextBlock>
            </div>
          </div>
        </div>
      </section>

      <section className="command-surface p-5 sm:p-6">
        <p className="field-label">Artist links</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {response.links.filter((link) => link.url).length ? (
            response.links
              .filter((link) => link.url)
              .map((link) => (
                <a
                  className="flex items-center justify-between gap-3 rounded-md border border-edge bg-input px-4 py-3 text-sm font-semibold text-secondary transition hover:border-edge-strong hover:text-ink"
                  href={link.url}
                  key={link.platform}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              ))
          ) : (
            <p className="text-sm italic text-muted">No links provided</p>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="field-label">Selected releases</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            {response.releases.length} submitted release
            {response.releases.length === 1 ? "" : "s"}
          </h2>
        </div>
        {response.releases.map((release, index) => (
          <article className="command-surface p-5 sm:p-6" key={release.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="field-label">
                  Release {index + 1} · {release.type}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-ink">
                  {release.title || "Untitled release"}
                </h3>
              </div>
              <span
                className={
                  release.isFeatured
                    ? "status-badge-ready"
                    : "status-badge-neutral"
                }
              >
                {release.isFeatured ? "START HERE / EDITORIAL" : "MORE FROM ARTIST"}
              </span>
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <MetaItem label="Release date" value={release.releaseDate} />
              <MetaItem label="Spotify" value={release.spotifyUrl} />
              <MetaItem label="Apple Music" value={release.appleMusicUrl} />
              <MetaItem label="YouTube" value={release.youtubeUrl} />
              <MetaItem label="Cover art" value={release.coverArtUrl} />
              <MetaItem
                label="Cover permission"
                value={
                  release.coverArtRightsConfirmed
                    ? "Confirmed"
                    : "Not confirmed"
                }
              />
              <MetaItem label="Featured video" value={release.featuredVideoUrl} />
              <MetaItem
                label="Languages"
                value={release.languages.join(", ")}
              />
              <MetaItem label="Genres" value={release.genres.join(", ")} />
              <MetaItem label="Moods" value={release.moods.join(", ")} />
              <MetaItem label="Themes" value={release.themes.join(", ")} />
              <MetaItem
                label="Best for"
                value={release.listenerContexts.join(", ")}
              />
            </dl>

            {release.isFeatured ? (
              <div className="mt-7 grid gap-6 border-t border-edge pt-6 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <p className="field-label">Track profile summary</p>
                  <div className="mt-3">
                    <TextBlock>{release.trackSummary}</TextBlock>
                  </div>
                </div>
                <div>
                  <p className="field-label">Collaborators</p>
                  <div className="mt-3">
                    <TextBlock>{release.collaborators}</TextBlock>
                  </div>
                </div>
                <div>
                  <p className="field-label">Credits</p>
                  <div className="mt-3">
                    <TextBlock>{release.credits}</TextBlock>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <p className="field-label">Lyrics</p>
                  <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-edge bg-input p-4 font-mono text-xs leading-6 text-secondary">
                    {release.lyrics || "Not provided"}
                  </pre>
                  <p className="mt-2 text-xs text-muted">
                    Lyric display permission:{" "}
                    {release.lyricsRightsConfirmed ? "Confirmed" : "Not confirmed"}
                  </p>
                </div>
                {release.breakdowns.length ? (
                  <div className="space-y-3 lg:col-span-2">
                    <p className="field-label">Breakdown suggestions</p>
                    {release.breakdowns.map((breakdown) => (
                      <div
                        className="rounded-md border border-edge bg-input p-4"
                        key={breakdown.id}
                      >
                        <p className="font-mono text-xs leading-6 text-brand-primary">
                          {breakdown.lyricExcerpt}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-secondary">
                          {breakdown.explanation}
                        </p>
                        {breakdown.referenceUrl ? (
                          <a
                            className="mt-3 inline-flex text-xs font-semibold text-brand-primary hover:underline"
                            href={breakdown.referenceUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open reference ↗
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="command-surface p-5 sm:p-6">
        <p className="field-label">Additional notes</p>
        <div className="mt-3">
          <TextBlock>{response.additionalNotes}</TextBlock>
        </div>
      </section>
    </div>
  );
}
