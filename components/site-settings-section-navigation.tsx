const siteSettingsSectionLinks = [
  {href: "#core-profile", label: "Core"},
  {href: "#metadata-seo", label: "Metadata"},
  {href: "#site-chrome", label: "Chrome"},
  {href: "#home-page", label: "Home"},
  {href: "#public-projects", label: "Project Approval"},
  {href: "#music-categories", label: "Project Content"},
  {href: "#music-page", label: "Music"},
  {href: "#about-page", label: "About"},
  {href: "#platform-labels", label: "Platforms"},
  {href: "#links-page", label: "Link Hub Defaults"},
  {href: "#link-hubs", label: "Link Hubs"},
  {href: "#playlists", label: "Playlists"},
  {href: "#exclusives-settings", label: "Exclusives"},
  {href: "#tracking-settings", label: "Tracking"},
  {href: "#release-page", label: "Release"},
  {href: "#social-links", label: "Social"},
  {href: "#vault-settings", label: "Vault"},
  {href: "#commissions-settings", label: "Commissions"},
  {href: "#public-readiness", label: "Readiness"},
  {href: "#appears-on", label: "Appears On"}
] as const;

const linkClassName =
  "rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-secondary transition hover:border-[rgba(246,201,69,0.35)] hover:bg-surface-hover hover:text-primary";

export function SiteSettingsSectionNavigation({
  variant
}: {
  variant: "inline" | "rail";
}) {
  if (variant === "inline") {
    return (
      <nav
        aria-label="Public site settings sections"
        className="command-surface mb-6 flex max-h-[40vh] flex-wrap gap-2 overflow-y-auto px-4 py-3 lg:sticky lg:top-3 lg:z-30 xl:hidden"
      >
        {siteSettingsSectionLinks.map((item) => (
          <a
            className={`${linkClassName} border-edge-strong bg-surface-elevated`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <aside className="hidden xl:block">
      <nav
        aria-label="Public site settings sections"
        className="command-surface fixed bottom-28 right-8 top-6 z-30 w-[220px] overflow-y-auto p-3"
      >
        <div className="border-b border-edge px-2 pb-3">
          <p className="table-label">Jump to section</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Public site controls
          </p>
        </div>
        <div className="mt-2 grid gap-1">
          {siteSettingsSectionLinks.map((item) => (
            <a
              className={`${linkClassName} border-transparent`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </aside>
  );
}
