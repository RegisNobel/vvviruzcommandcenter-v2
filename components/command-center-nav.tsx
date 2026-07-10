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
      <header className="sticky top-0 z-40 border-b border-edge bg-sidebar/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-col items-stretch gap-3 px-3 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-between gap-4">
            <Link className="flex min-w-0 items-center gap-3" href="/admin/releases">
              <span className="shrink-0 rounded-md bg-brand-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-inverse">
                Admin
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">
                  vvviruz&apos; command center
                </p>
              </div>
            </Link>
            <form action="/admin/logout" className="shrink-0" method="post">
              <button className="action-button-danger px-3 py-1.5 text-xs">
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
                  <button
                    aria-controls="admin-promo-mobile-menu"
                    aria-expanded={isPromoExpanded}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-md border px-3.5 py-1.5 text-xs font-semibold transition",
                      isActive
                        ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                        : "border-edge bg-surface-elevated text-secondary hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
                    )}
                    key={item.href}
                    onClick={() => setIsPromoExpanded(!isPromoExpanded)}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] opacity-60">{isPromoExpanded ? "^" : "v"}</span>
                  </button>
                );
              }

              return (
                <Link
                  className={cn(
                    "shrink-0 rounded-md border px-3.5 py-1.5 text-xs font-semibold transition",
                    isActive
                      ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                      : "border-edge bg-surface-elevated text-secondary hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {isPromoExpanded ? (
            <nav
              aria-label="Promo tools"
              className="grid grid-cols-2 gap-2 rounded-lg border border-edge bg-input p-2 sm:grid-cols-3"
              id="admin-promo-mobile-menu"
            >
              {promoSubItems.map((sub) => {
                const isSubActive =
                  pathname === sub.href ||
                  (sub.href !== "/admin/promo" && pathname.startsWith(`${sub.href}/`)) ||
                  (sub.href === "/admin/promo" && pathname === "/admin/promo");

                return (
                  <Link
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-center text-xs font-semibold transition",
                      isSubActive
                        ? "border-[rgba(246,201,69,0.36)] bg-brand-primary-soft text-brand-primary"
                        : "border-edge bg-surface-elevated text-secondary hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
                    )}
                    href={sub.href}
                    key={sub.href}
                  >
                    {sub.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </header>

      {/* Desktop Persistent Left Sidebar (hidden on mobile/tablet) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-edge bg-sidebar px-4 py-6 lg:flex lg:flex-col lg:justify-between">
        <div className="flex flex-col gap-6">
          {/* Brand logo & header */}
          <div className="flex flex-col gap-4 border-b border-edge pb-5">
            <Link className="flex flex-col items-start gap-2" href="/admin/releases">
              <span className="shrink-0 rounded-md bg-brand-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-inverse">
                Admin
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-wide text-ink">
                  vvviruz&apos; command center
                </p>
                <p className="mt-1 text-xs text-muted">
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
                        "flex w-full items-center justify-between rounded-md border px-4 py-2.5 text-left text-sm font-semibold transition",
                        isActive
                          ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                          : "border-edge bg-surface-elevated text-secondary hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
                      )}
                    >
                      <span>{item.label}</span>
                      <span className={cn("text-xs transition-transform duration-200", isPromoExpanded ? "rotate-180" : "")}>
                        v
                      </span>
                    </button>
                    {isPromoExpanded && (
                      <div className="ml-4 mt-1 flex flex-col gap-2 border-l border-edge py-1 pl-4 pr-1">
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
                                "block rounded-md border p-3 text-left transition",
                                isSubActive
                                  ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                                  : "border-edge bg-input text-secondary hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
                              )}
                            >
                              <div className="text-xs font-semibold">{sub.label}</div>
                              <div className="mt-1 text-[10px] font-normal leading-4 text-muted opacity-85">
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
                    "block w-full shrink-0 rounded-md border px-4 py-2.5 text-left text-sm font-semibold transition",
                    isActive
                      ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                      : "border-edge bg-surface-elevated text-secondary hover:border-edge-strong hover:bg-surface-hover hover:text-primary"
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
        <div className="border-t border-edge pt-5">
          <form action="/admin/logout" className="w-full" method="post">
            <button className="action-button-danger w-full px-4 py-2.5 text-sm">
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
