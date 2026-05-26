"use client";

import React from "react";
import { cn } from "@/lib/utils";

type StickyContextBarProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  isVisible: boolean;
};

export function StickyContextBar({
  title,
  subtitle,
  leftSlot,
  centerSlot,
  rightSlot,
  children,
  className,
  isVisible
}: StickyContextBarProps) {
  return (
    <div
      className={cn(
        "fixed top-4 left-0 right-0 lg:left-64 z-30 transition-all duration-200 px-4 sm:px-6 lg:px-8",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-3 opacity-0",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[#30343b] bg-[#101215]/95 px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            {leftSlot}
            <div>
              <div className="text-lg font-semibold text-ink leading-none">{title}</div>
              {subtitle && <div className="text-xs text-muted mt-1 leading-none">{subtitle}</div>}
            </div>
          </div>
          {centerSlot && <div className="flex-1 max-w-md mx-4">{centerSlot}</div>}
          <div className="flex items-center gap-3">
            {rightSlot}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
