import Image from "next/image";
import Link from "next/link";

import type {SiteSettingsRecord} from "@/lib/types";

import {DEFAULT_SITE_LOGO_FILE, getSiteIconUrl} from "@/lib/site-assets";

export function PublicSiteChrome({
  children,
  siteSettings
}: {
  children: React.ReactNode;
  siteSettings: SiteSettingsRecord;
}) {
  const navItems = [
    {href: "/", label: siteSettings.site_content.chrome.nav_home_label},
    {href: "/music", label: siteSettings.site_content.chrome.nav_music_label},
    {href: "/about", label: siteSettings.site_content.chrome.nav_about_label},
    {href: "/links", label: siteSettings.site_content.chrome.nav_links_label},
    {href: "/exclusive", label: siteSettings.site_content.chrome.nav_exclusive_label || "Exclusive"}
  ];

  return (
    <div className="min-h-screen bg-[#090b0f] text-[#f3eddf]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090b0f]/86 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] flex-col items-stretch gap-3 px-3 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link className="min-w-0" href="/">
            <div className="inline-flex items-center gap-3">
              <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#c9a347]/40 bg-[#c9a347]/10 sm:h-11 sm:w-11">
                <Image
                  alt={
                    siteSettings.site_content.chrome.brand_mark_text ||
                    `${siteSettings.artist_name} mark`
                  }
                  className="object-cover"
                  fill
                  sizes="44px"
                  src={getSiteIconUrl(
                    siteSettings.site_content.chrome.brand_mark_file || DEFAULT_SITE_LOGO_FILE
                  )}
                  unoptimized
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-[0.04em] text-[#f3eddf] sm:text-lg">
                  {siteSettings.artist_name}
                </p>
                <p className="hidden truncate text-xs uppercase tracking-[0.24em] text-[#8d949d] sm:block">
                  {siteSettings.site_content.chrome.brand_subtitle_text}
                </p>
              </div>
            </div>
          </Link>

          <nav aria-label="Public navigation" className="mobile-scroll-x flex items-center gap-2 lg:mx-0 lg:px-0">
            {navItems.map((item) => (
              <Link
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-[#e7dfcf] transition hover:border-[#c9a347]/40 hover:bg-[#c9a347]/10 hover:text-[#f6f0e4]"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.16),transparent_42%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%)]" />
        {children}
      </div>

      <footer className="border-t border-white/10 bg-[#0b0e12]">
        <div className="mx-auto max-w-[1280px] px-4 py-6 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-[#98a0a8]">
            {siteSettings.site_content.chrome.footer_copyright_text}
          </p>
        </div>
      </footer>
    </div>
  );
}




