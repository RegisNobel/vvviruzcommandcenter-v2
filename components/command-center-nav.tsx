"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState, useEffect} from "react";

import {cn} from "@/lib/utils";

const navItems = [
  {href: "/admin/releases", label: "Releases"},
  {href: "/admin/promo", label: "Promo"},
  {href: "/admin/audience", label: "Audience"},
  {href: "/admin/site", label: "Public Site"},
  {href: "/admin/commissions", label: "Commissions"},
  {href: "/admin/backups", label: "Backups"}
];

const promoSubItems = [
  {
    href: "/admin/promo",
    label: "Promo Home",
    description: "Campaign overview and current release context."
  },
  {
    href: "/admin/copy-lab",
    label: "Copy Lab",
    description: "Write hooks, captions, and campaign copy."
  },
  {
    href: "/admin/short-links",
    label: "Short Links",
    description: "Create tracked campaign URLs."
  },
  {
    href: "/admin/ad-lab",
    label: "Ad Lab",
    description: "Upload Meta snapshots into Ad Lab."
  },
  {
    href: "/admin/attribution",
    label: "Attribution",
    description: "Compare Meta traffic against first-party link behavior."
  },
  {
    href: "/admin/promo/playlists",
    label: "Playlists",
    description: "Manage streaming playlists and campaign landing pages."
  }
];

export function CommandCenterNav() {
  const pathname = usePathname();

  const isPromoRoute =
    pathname === "/admin/promo" ||
    pathname.startsWith("/admin/promo/") ||
    pathname === "/admin/copy-lab" ||
    pathname.startsWith("/admin/copy-lab/") ||
    pathname === "/admin/short-links" ||
    pathname.startsWith("/admin/short-links/") ||
    pathname === "/admin/ad-lab" ||
    pathname.startsWith("/admin/ad-lab/") ||
    pathname === "/admin/attribution" ||
    pathname.startsWith("/admin/attribution/");

  const [isPromoExpanded, setIsPromoExpanded] = useState(isPromoRoute);

  useEffect(() => {
    if (isPromoRoute) {
      setIsPromoExpanded(true);
    }
  }, [pathname, isPromoRoute]);

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
              const isPromo = item.href === "/admin/promo";
              let isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              if (isPromo) {
                isActive = isPromoRoute;
              }

              if (isPromo) {
                return (
                  <div key={item.href} className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsPromoExpanded(!isPromoExpanded)}
                      className={cn(
                        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition border flex items-center gap-1",
                        isActive
                          ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                          : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] opacity-60">{isPromoExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isPromoExpanded && promoSubItems.map((sub) => {
                      const isSubActive =
                        pathname === sub.href ||
                        (sub.href !== "/admin/promo" && pathname.startsWith(`${sub.href}/`)) ||
                        (sub.href === "/admin/promo" && pathname === "/admin/promo");
                      return (
                        <Link
                          href={sub.href}
                          key={sub.href}
                          className={cn(
                            "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition border",
                            isSubActive
                              ? "border-[#5b4920] bg-[#1a1710]/80 text-[#d7b45e]"
                              : "border-[#25282e] bg-[#0d0f12] text-[#aeb3bb] hover:border-[#42464f] hover:bg-[#15181c]"
                          )}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                );
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
          <nav aria-label="Admin desktop navigation" className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-180px)] pr-1 scrollbar-thin">
            {navItems.map((item) => {
              const isPromo = item.href === "/admin/promo";
              let isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              if (isPromo) {
                isActive = isPromoRoute;
              }

              if (isPromo) {
                return (
                  <div key={item.href} className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => setIsPromoExpanded(!isPromoExpanded)}
                      className={cn(
                        "w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition text-left flex items-center justify-between",
                        isActive
                          ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                          : "border-[#30343b] bg-[#15181c] text-[#d5d9df] hover:border-[#545962] hover:bg-[#1b1f24]"
                      )}
                    >
                      <span>{item.label}</span>
                      <span className={cn("text-xs transition-transform duration-200", isPromoExpanded ? "rotate-180" : "")}>
                        ▼
                      </span>
                    </button>
                    {isPromoExpanded && (
                      <div className="pl-4 pr-1 py-1 flex flex-col gap-2 mt-1 border-l border-[#272b31]/40 ml-4">
                        {promoSubItems.map((sub) => {
                          const isSubActive =
                            pathname === sub.href ||
                            (sub.href !== "/admin/promo" && pathname.startsWith(`${sub.href}/`)) ||
                            (sub.href === "/admin/promo" && pathname === "/admin/promo");
                          return (
                            <Link
                              href={sub.href}
                              key={sub.href}
                              className={cn(
                                "rounded-[14px] border p-3 text-left transition block",
                                isSubActive
                                  ? "border-[#5b4920] bg-[#1a1710] text-[#d7b45e]"
                                  : "border-[#25282e] bg-[#0d0f12] text-[#d5d9df] hover:border-[#42464f] hover:bg-[#121519]"
                              )}
                            >
                              <div className="text-xs font-semibold">{sub.label}</div>
                              <div className="text-[10px] text-[#8a9098] font-normal leading-4 mt-1 opacity-85">
                                {sub.description}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  className={cn(
                    "w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition text-left block shrink-0",
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
