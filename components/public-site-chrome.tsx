import Image from "next/image";
import Link from "next/link";

import type {SiteSettingsRecord} from "@/lib/types";
import {getSiteIconUrl} from "@/lib/site-assets";
import {PublicMobileNav} from "@/components/public-mobile-nav";

export async function PublicSiteChrome({
  children,
  siteSettings
}: {
  children: React.ReactNode;
  siteSettings: SiteSettingsRecord;
}) {
  const navItems = [
    {href: "/music", label: siteSettings.site_content.chrome.nav_music_label},
    {href: "/projects", label: "Projects"}
  ];

  if (siteSettings.nav_hubs && siteSettings.nav_hubs.length > 0) {
    for (const hub of siteSettings.nav_hubs) {
      navItems.push({
        href: `/${hub.path}`,
        label: hub.path === "links" ? siteSettings.site_content.chrome.nav_links_label : hub.label
      });
    }
  } else {
    navItems.push({href: "/links", label: siteSettings.site_content.chrome.nav_links_label});
  }

  navItems.push({href: "/exclusives", label: "Exclusives"});
  navItems.push({href: "/about", label: siteSettings.site_content.chrome.nav_about_label});

  if (siteSettings.site_content.commissions?.is_enabled) {
    navItems.push({href: "/commissions", label: "Commissions"});
  }

  if (siteSettings.site_content.vault?.is_enabled) {
    navItems.push({href: "/vault", label: "Vault"});
  }

  return (
    <div className="public-app flex min-h-screen flex-col">
      <header className="public-chrome sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] flex-col items-stretch gap-3 px-3 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link className="min-w-0 lg:hidden" href="/">
            <div className="inline-flex items-center gap-3">
              <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[rgba(246,201,69,0.42)] bg-[var(--brand-primary-soft)] sm:h-11 sm:w-11">
                <Image
                  alt={
                    siteSettings.site_content.chrome.brand_mark_text ||
                    `${siteSettings.artist_name} mark`
                  }
                  className="object-cover"
                  fill
                  sizes="44px"
                  src={getSiteIconUrl(
                    siteSettings.site_content.chrome.brand_mark_file || "logo_header.png"
                  )}
                  unoptimized={!siteSettings.site_content.chrome.brand_mark_file}
                />
              </span>
              <div className="min-w-0">
                <p className="public-brand-name truncate text-base font-semibold tracking-[0.04em] sm:text-lg">
                  {siteSettings.artist_name}
                </p>
                <p className="public-brand-subtitle hidden truncate text-xs uppercase tracking-[0.24em] sm:block">
                  {siteSettings.site_content.chrome.brand_subtitle_text}
                </p>
              </div>
            </div>
          </Link>

          <PublicMobileNav items={navItems} />

          <Link className="hidden min-w-0 lg:block" href="/">
            <div className="inline-flex items-center gap-3">
              <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[rgba(246,201,69,0.42)] bg-[var(--brand-primary-soft)] sm:h-11 sm:w-11">
                <Image
                  alt={
                    siteSettings.site_content.chrome.brand_mark_text ||
                    `${siteSettings.artist_name} mark`
                  }
                  className="object-cover"
                  fill
                  sizes="44px"
                  src={getSiteIconUrl(
                    siteSettings.site_content.chrome.brand_mark_file || "logo_header.png"
                  )}
                  unoptimized={!siteSettings.site_content.chrome.brand_mark_file}
                />
              </span>
              <div className="min-w-0">
                <p className="public-brand-name truncate text-base font-semibold tracking-[0.04em] sm:text-lg">
                  {siteSettings.artist_name}
                </p>
                <p className="public-brand-subtitle hidden truncate text-xs uppercase tracking-[0.24em] sm:block">
                  {siteSettings.site_content.chrome.brand_subtitle_text}
                </p>
              </div>
            </div>
          </Link>

          <nav aria-label="Public navigation" className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <Link
                className="public-nav-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="public-canvas flex-grow">
        {children}
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-[1280px] px-4 py-6 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-[#9da7b1]">
            {siteSettings.site_content.chrome.footer_copyright_text}
          </p>
        </div>
      </footer>

    </div>
  );
}
