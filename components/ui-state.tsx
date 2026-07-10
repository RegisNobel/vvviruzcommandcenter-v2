import type {ReactNode} from "react";
import {AlertCircle, Inbox, LoaderCircle} from "lucide-react";

type StateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: StateAction;
  icon?: ReactNode;
  compact?: boolean;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact = false
}: EmptyStateProps) {
  const actionClassName = "action-button-secondary mt-4 text-xs";

  return (
    <div className={`state-empty ${compact ? "py-5" : "py-8"}`}>
      <div className="mx-auto flex max-w-md flex-col items-center">
        <span className="mb-3 text-muted">{icon ?? <Inbox size={20} />}</span>
        <p className="font-semibold text-ink">{title}</p>
        {description ? <p className="mt-1.5 text-muted">{description}</p> : null}
        {action?.href ? (
          <a className={actionClassName} href={action.href}>
            {action.label}
          </a>
        ) : null}
        {action?.onClick ? (
          <button className={actionClassName} onClick={action.onClick} type="button">
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  action?: StateAction;
};

export function ErrorState({
  title = "Something needs attention",
  message,
  action
}: ErrorStateProps) {
  return (
    <div className="state-panel-danger" role="alert">
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-1">{message}</p>
        {action?.href ? (
          <a className="action-button-secondary mt-3 text-xs" href={action.href}>
            {action.label}
          </a>
        ) : null}
        {action?.onClick ? (
          <button className="action-button-secondary mt-3 text-xs" onClick={action.onClick} type="button">
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function LoadingState({label = "Loading"}: {label?: string}) {
  return (
    <div aria-live="polite" className="state-loading" role="status">
      <LoaderCircle className="animate-spin" size={16} />
      <span>{label}</span>
    </div>
  );
}
