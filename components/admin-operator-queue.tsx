import Link from "next/link";
import {Activity, ArrowUpRight, Download, RefreshCw} from "lucide-react";

import type {AdminOperatorQueueRecord} from "@/lib/types";

function formatDate(value: string) {
  if (!value) return "No date set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date set";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function QueueCell({
  detail,
  href,
  label,
  tone = "neutral",
  value
}: {
  detail: string;
  href: string;
  label: string;
  tone?: "critical" | "healthy" | "info" | "neutral" | "warning";
  value: string;
}) {
  const toneClass = {
    critical: "border-[rgba(223,107,107,0.35)] bg-[rgba(223,107,107,0.08)]",
    healthy: "border-[rgba(79,191,136,0.3)] bg-[rgba(79,191,136,0.07)]",
    info: "border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.07)]",
    neutral: "border-edge bg-surface-elevated",
    warning: "border-[rgba(246,201,69,0.32)] bg-brand-primary-soft"
  }[tone];

  return (
    <Link
      className={`group min-w-0 rounded-lg border px-4 py-4 transition hover:-translate-y-0.5 hover:border-brand-primary/50 ${toneClass}`}
      href={href}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="table-label">{label}</p>
        <ArrowUpRight className="shrink-0 text-muted transition group-hover:text-brand-primary" size={14} />
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-ink" title={value}>
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted" title={detail}>
        {detail}
      </p>
    </Link>
  );
}

function ExportQueueCell() {
  return (
    <form action="/api/releases/export" className="min-w-0" method="get">
      <button
        className="group h-full w-full rounded-lg border border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.07)] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-brand-primary/50"
        type="submit"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="table-label">Export</span>
          <Download className="shrink-0 text-muted transition group-hover:text-brand-primary" size={14} />
        </span>
        <span className="mt-3 block text-sm font-semibold text-ink">
          Public song codes
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
          Download titles, UPCs, and ISRCs for public releases.
        </span>
      </button>
    </form>
  );
}

export function AdminOperatorQueue({
  queue,
  refreshAction
}: {
  queue: AdminOperatorQueueRecord;
  refreshAction: () => Promise<void>;
}) {
  const nextRelease = queue.next_release;
  const campaign = queue.active_campaign;
  const decision = queue.latest_decision;
  const issue = queue.critical_issue;

  return (
    <section className="command-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Activity className="text-brand-primary" size={16} />
          <div>
            <p className="table-label">Operator Queue</p>
            <p className="mt-1 text-xs text-muted">
              Current release, campaign, and system signals only.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={queue.issue_count > 0 ? "status-badge-warning" : "status-badge-ready"}>
            {queue.issue_count > 0 ? `${queue.issue_count} issue${queue.issue_count === 1 ? "" : "s"}` : "Systems clear"}
          </span>
          <form action={refreshAction}>
            <button className="action-button-secondary px-3 py-2" type="submit">
              <RefreshCw size={14} />
              Refresh checks
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4 2xl:grid-cols-7">
        <QueueCell
          detail={nextRelease ? `${formatDate(nextRelease.release_date)} / ${nextRelease.stage}` : "Add the next planned release."}
          href={nextRelease?.action_path ?? "/admin/releases/new"}
          label="Next Release"
          value={nextRelease?.title ?? "Not scheduled"}
        />
        <QueueCell
          detail={queue.primary_blocker.detail}
          href={queue.primary_blocker.action_path}
          label="Primary Blocker"
          tone={queue.primary_blocker.label === "Blocked" ? "warning" : "neutral"}
          value={queue.primary_blocker.label}
        />
        <QueueCell
          detail={campaign?.release_title ?? "Import a Meta CSV when a campaign starts."}
          href={campaign?.action_path ?? "/admin/ad-lab/import"}
          label="Active Campaign"
          tone="info"
          value={campaign?.label ?? "No open snapshot"}
        />
        <QueueCell
          detail={decision ? `${decision.release_title} / ${formatDate(decision.reviewed_at)}` : "Archive a test cycle to create campaign memory."}
          href={decision?.action_path ?? "/admin/ad-lab"}
          label="Latest Decision"
          value={decision?.label ?? "No archived decision"}
        />
        <QueueCell
          detail={queue.backup_health.detail}
          href={queue.backup_health.action_path}
          label="Backup Health"
          tone={queue.backup_health.status}
          value={queue.backup_health.label}
        />
        <QueueCell
          detail={issue?.message ?? "No current operational issue needs action."}
          href={issue?.action_path || "/admin/backups"}
          label="Critical System Issue"
          tone={issue?.severity ?? "healthy"}
          value={issue?.title ?? "None detected"}
        />
        <ExportQueueCell />
      </div>
    </section>
  );
}
