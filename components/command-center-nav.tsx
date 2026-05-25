"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

import {cn} from "@/lib/utils";

const navItems = [
  {href: "/admin/releases", label: "Releases"},
  {href: "/admin/ad-lab", label: "Promo"},
  {href: "/admin/audience", label: "Audience"},
  {href: "/admin/site", label: "Public Site"},
  {href: "/admin/commissions", label: "Commissions"},
  {href: "/admin/backups", label: "Backups"}
];

export function CommandCenterNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Top Header (hidden on desktop) */}
      <header className="sticky top-0 z-40 border-b border-[#272b31] bg-[#101215]/92 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-col items-stretch gap-3 px-3 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-between gap-4">
            <Link className="flex min-w-0 items-center gap-3" href="/admin/releases">
              <span className="shrink-0 rounded-full bg-[#c9a347] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#13161a]">
                Admin
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#ece6da]">
                  vvviruz&apos; command center
                </p>
              </div>
            </Link>
            <form action="/admin/logout" className="shrink-0" method="post">
              <button className="rounded-full border border-[#7b3e3e] bg-[#341919] px-3 py-1.5 text-xs font-semibold text-[#f0d7d2] transition hover:border-[#9a5656] hover:bg-[#452020]">
                Logout
              </button>
            </form>
          </div>

          <nav aria-label="Admin mobile navigation" className="mobile-scroll-x flex items-center gap-2">
            {navItems.map((item) => {
              let isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              if (item.href === "/admin/ad-lab") {
                isActive =
                  isActive ||
                  pathname === "/admin/copy-lab" ||
                  pathname.startsWith("/admin/copy-lab/") ||
                  pathname === "/admin/short-links" ||
                  pathname.startsWith("/admin/short-links/") ||
                  pathname === "/admin/attribution" ||
                  pathname.startsWith("/admin/attribution/");
              }

              return (
                <Link
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition border",
                    isActive
                      ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                      : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Desktop Persistent Left Sidebar (hidden on mobile/tablet) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#272b31] bg-[#101215] px-4 py-6 lg:flex lg:flex-col lg:justify-between">
        <div className="flex flex-col gap-6">
          {/* Brand logo & header */}
          <div className="flex flex-col gap-4 border-b border-[#272b31] pb-5">
            <Link className="flex flex-col items-start gap-2" href="/admin/releases">
              <span className="shrink-0 rounded-full bg-[#c9a347] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#13161a]">
                Admin
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-[#ece6da] tracking-wide">
                  vvviruz&apos; command center
                </p>
                <p className="mt-1 text-xs text-[#8f959d]">
                  Local creative ops & analytics
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation link list */}
          <nav aria-label="Admin desktop navigation" className="flex flex-col gap-2">
            {navItems.map((item) => {
              let isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              if (item.href === "/admin/ad-lab") {
                isActive =
                  isActive ||
                  pathname === "/admin/copy-lab" ||
                  pathname.startsWith("/admin/copy-lab/") ||
                  pathname === "/admin/short-links" ||
                  pathname.startsWith("/admin/short-links/") ||
                  pathname === "/admin/attribution" ||
                  pathname.startsWith("/admin/attribution/");
              }

              return (
                <Link
                  className={cn(
                    "w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition text-left block",
                    isActive
                      ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                      : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer/Logout Action */}
        <div className="border-t border-[#272b31] pt-5">
          <form action="/admin/logout" className="w-full" method="post">
            <button className="w-full rounded-full border border-[#7b3e3e] bg-[#341919] px-4 py-2.5 text-sm font-semibold text-[#f0d7d2] transition hover:border-[#9a5656] hover:bg-[#452020]">
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
