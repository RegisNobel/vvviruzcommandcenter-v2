export const LATEST_INTEL_PUBLIC_LIMIT = 5;

const HIDDEN_PUBLIC_PATHS = new Set([
  "/commissions",
  "/artists",
  "/exclusive",
  "/exclusives",
  "/links",
  "/preview",
  "/unsubscribe",
  "/vault"
]);

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function pathMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function shouldShowLatestIntel(pathname: string, configuredHubPaths: string[] = []) {
  const normalizedPathname = normalizePath(pathname);
  if (
    HIDDEN_PUBLIC_PATHS.has(normalizedPathname) ||
    pathMatches(normalizedPathname, "/artists") ||
    pathMatches(normalizedPathname, "/preview") ||
    pathMatches(normalizedPathname, "/listen")
  ) {
    return false;
  }

  return !configuredHubPaths
    .map(normalizePath)
    .some((hubPath) => hubPath !== "/" && pathMatches(normalizedPathname, hubPath));
}

export function getLatestIntelTypeLabel(type: string) {
  if (type === "release") return "Upcoming release";
  if (type === "annotation") return "Behind the music";
  if (type === "project") return "Project update";
  if (type === "vault") return "Exclusive";
  return "Update";
}
