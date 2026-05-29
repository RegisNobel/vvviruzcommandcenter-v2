"use client";

import React from "react";
import { cn } from "@/lib/utils";

type StickyActionDockProps = {
  label?: React.ReactNode;
  statusSlot?: React.ReactNode;
  primaryActionSlot?: React.ReactNode;
  secondaryActionsSlot?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  isVisible: boolean;
  position?: "fixed" | "sticky";
  maxWidth?: string;
};

export function StickyActionDock({
  label,
  statusSlot,
  primaryActionSlot,
  secondaryActionsSlot,
  children,
  className,
  isVisible,
  position = "fixed",
  maxWidth
}: StickyActionDockProps) {
  const isSticky = position === "sticky";

  return (
    <div
      className={cn(
        isSticky
          ? "sticky bottom-6 z-30 w-full transition-all duration-200"
          : "fixed bottom-6 left-4 right-4 sm:left-6 sm:right-6 lg:left-[288px] lg:right-[32px] z-30 transition-all duration-200",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
        className
      )}
    >
      <div className={cn("mx-auto w-full", isSticky ? "" : (maxWidth ?? "max-w-[1600px]"))}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#30343b] bg-[#101215]/95 px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:px-6">
          {label && (
            <div className="hidden text-base font-semibold text-ink lg:block">
              {label}
            </div>
          )}
          <div className="flex w-full flex-wrap items-center justify-between gap-3 lg:w-auto lg:flex-nowrap lg:justify-end">
            {statusSlot && (
              <div className="flex items-center gap-2">
                {statusSlot}
              </div>
            )}
            <div className="flex items-center gap-2">
              {secondaryActionsSlot}
              {primaryActionSlot}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
