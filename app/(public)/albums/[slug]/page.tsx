import {notFound, permanentRedirect} from "next/navigation";

import {getPublicProjectBySlug} from "@/lib/repositories/public-site";

const legacyAlbumProjectSlugs: Record<string, string> = {
  "massive-imitation": "mi"
};

export default async function LegacyAlbumDetailPage({
  params
}: {
  params: Promise<{slug: string}>;
}) {
  const {slug} = await params;
  const projectSlug = legacyAlbumProjectSlugs[slug] || slug;
  const project = await getPublicProjectBySlug(projectSlug);

  if (!project) {
    notFound();
  }

  permanentRedirect(`/projects/${encodeURIComponent(project.slug)}`);
}
