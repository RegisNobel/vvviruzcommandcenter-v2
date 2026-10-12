// Only artwork already published on the public site is bundled. New uploads retain
// their own URLs, so replacing artwork in the editor does not require a deployment.
const bundledCovers = new Set([
  "38e8f37a-df60-4293-a7d3-88bcd016580e.jpg",
  "5c354117-66ec-4f4f-a033-a18fccbbbe6c.jpg"
]);

export function resolveBundledCover(url: string): string | null {
  const match = url.match(/^(?:\/api\/assets\/cover\/|https:\/\/der42gjtvxvutavf\.public\.blob\.vercel-storage\.com\/vvviruz\/cover\/)([^/?#]+)(?:[?#].*)?$/);
  return match && bundledCovers.has(match[1]) ? `/project-covers/${match[1]}` : null;
}
