"use client";

import Link from "next/link";
import {Menu, X} from "lucide-react";
import {useEffect, useState} from "react";
import {usePathname} from "next/navigation";

type PublicNavItem = {
  href: string;
  label: string;
};

function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicMobileNav({items}: {items: PublicNavItem[]}) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const musicItem = items.find((item) => item.href === "/music");
  const currentReleaseItem = items.find((item) => /^\/links\d*$/.test(item.href));
  const primaryItems = [musicItem, currentReleaseItem]
    .filter((item): item is PublicNavItem => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 2);
  const moreItems = items.filter(
    (item) => !primaryItems.some((primaryItem) => primaryItem.href === item.href)
  );
  const hasCurrentMoreItem = moreItems.some((item) => isCurrentRoute(pathname, item.href));

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <nav aria-label="Public navigation" className="flex items-center gap-1">
        {primaryItems.map((item) => (
          <Link
            className={`public-nav-link ${isCurrentRoute(pathname, item.href) ? "public-nav-link-active" : ""}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
        {moreItems.length > 0 ? (
          <button
            aria-controls="public-mobile-more-menu"
            aria-expanded={isMoreOpen}
            className={`public-nav-link inline-flex items-center gap-1 ${hasCurrentMoreItem ? "public-nav-link-active" : ""}`}
            onClick={() => setIsMoreOpen((current) => !current)}
            type="button"
          >
            More
            {isMoreOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        ) : null}
      </nav>

      {isMoreOpen ? (
        <nav
          aria-label="More public navigation"
          className="public-nav-more-panel mt-2 grid grid-cols-2 gap-2 p-2"
          id="public-mobile-more-menu"
        >
          {moreItems.map((item) => (
            <Link
              className={`public-nav-more-link px-3 py-2.5 text-center text-xs font-semibold transition ${
                isCurrentRoute(pathname, item.href)
                  ? "public-nav-more-link-active"
                  : ""
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
