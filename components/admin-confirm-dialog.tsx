"use client";

import {useEffect, useRef, type ReactNode} from "react";
import {X} from "lucide-react";

export function AdminConfirmDialog({
  open,
  title,
  description,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      (dialogRef.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ||
        dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]), a[href]"))?.focus();
    });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div aria-describedby={description ? "admin-dialog-description" : undefined} aria-labelledby="admin-dialog-title" aria-modal="true" className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6" ref={dialogRef} role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink" id="admin-dialog-title">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-muted" id="admin-dialog-description">{description}</p> : null}
          </div>
          <button aria-label="Close dialog" className="rounded-md border border-edge p-2 text-muted hover:text-ink" onClick={onClose} type="button"><X aria-hidden="true" size={16} /></button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
