"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

import {cn} from "@/lib/utils";

const navItems = [
  {href: "/admin", label: "Overview"},
  {href: "/admin/audience", label: "Audience"},
  {href: "/admin/site", label: "Public Site"},
  {href: "/admin/analytics", label: "Analytics"},
  {href: "/admin/ads", label: "Ads"},
  {href: "/admin/copy-lab", label: "Copy Lab"},
  {href: "/admin/photo-lab", label: "Photo Lab"},
  {href: "/admin/releases/roadmap", label: "Roadmap"},
  {href: "/admin/releases", label: "Releases"}
];

export function CommandCenterNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#272b31] bg-[#101215]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-col items-stretch gap-3 px-3 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link className="flex min-w-0 items-center gap-3" href="/admin">
          <span className="shrink-0 rounded-full bg-[#c9a347] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#13161a]">
            Admin
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[#ece6da] sm:text-lg">
              vvviruz&apos; command center
            </p>
            <p className="hidden truncate text-sm text-[#8f959d] sm:block">
              Local projects, analytics, copy, releases, and creative ops
            </p>
          </div>
        </Link>

        <nav aria-label="Admin navigation" className="mobile-scroll-x flex items-center gap-2 lg:mx-0 lg:px-0">
          {navItems.map((item) => {
            const isRoadmapRoute = pathname.startsWith("/admin/releases/roadmap");
            const isActive =
              item.href === "/admin"
                ? pathname === item.href
                : item.href === "/admin/releases" && isRoadmapRoute
                  ? false
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                    : "border border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}

          <form action="/admin/logout" className="shrink-0" method="post">
            <button className="rounded-full border border-[#7b3e3e] bg-[#341919] px-4 py-2 text-sm font-semibold text-[#f0d7d2] transition hover:border-[#9a5656] hover:bg-[#452020]">
              Logout
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
