export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import type {Metadata} from "next";
import {ArrowUpRight, Disc3} from "lucide-react";

import {
  ProjectTrackedLink,
  ProjectsIndexAnalytics
} from "@/components/public-project-analytics";
import {getPublicProjectPath} from "@/lib/public-projects";
import {getPublicReleaseDiscoveryMetadata} from "@/lib/public-utils";
import {getEligiblePublicProjects} from "@/lib/repositories/public-site";

export async function generateMetadata(): Promise<Metadata> {
  const projects = await getEligiblePublicProjects();
  const description =
    "Explore the recurring series and creative worlds behind vvviruz releases.";

  return {
    title: "Projects",
    description,
    alternates: {canonical: "/projects"},
    robots: projects.length > 0 ? {index: true, follow: true} : {index: false, follow: true},
    openGraph: {title: "vvviruz Projects", description, url: "/projects"},
    twitter: {card: "summary", title: "vvviruz Projects", description}
  };
}

export default async function PublicProjectsPage() {
  const projects = await getEligiblePublicProjects();

  return (
    <main className="public-page-wrap">
      <ProjectsIndexAnalytics />
      <div className="space-y-10">
        <section className="public-panel overflow-hidden px-5 py-9 sm:px-9 sm:py-11">
          <p className="public-eyebrow">Recurring worlds</p>
          <h1 className="public-heading mt-4 max-w-4xl text-4xl font-semibold sm:text-6xl">
            Projects
          </h1>
          <p className="public-copy mt-5 max-w-3xl text-sm leading-7 sm:text-base">
            Explore the recurring series and creative worlds behind vvviruz releases.
          </p>
          <Link className="public-action-secondary mt-7" href="/music">
            Browse all music
          </Link>
        </section>

        {projects.length > 0 ? (
          <section aria-label="vvviruz projects" className="grid gap-6 md:grid-cols-2">
            {projects.map((project, index) => {
              const release = project.representativeRelease;
              const {coverArtAltText} = getPublicReleaseDiscoveryMetadata(release);
              const href = getPublicProjectPath(project.slug);

              return (
                <article className="public-release-card group" key={project.id}>
                  <ProjectTrackedLink
                    categorySlug={project.slug}
                    eventType="project_card_click"
                    href={href}
                    page="projects"
                    position={index + 1}
                    sourcePage="projects-index"
                  >
                    <div className="grid sm:grid-cols-[0.72fr_1.28fr]">
                      <div className="public-art-frame relative aspect-square">
                        {release.cover_art_path ? (
                          <Image
                            alt={`${project.name} project artwork, represented by ${coverArtAltText}`}
                            className="object-cover transition duration-500 group-hover:scale-[1.03]"
                            fill
                            priority={index < 2}
                            sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1279px) 36vw, 360px"
                            src={release.cover_art_path}
                          />
                        ) : (
                          <div className="public-art-placeholder items-center justify-center">
                            <Disc3 aria-hidden="true" size={36} />
                          </div>
                        )}
                      </div>
                      <div className="flex min-h-full flex-col p-6 sm:p-7">
                        <p className="public-eyebrow">
                          {project.releaseCount} {project.releaseCount === 1 ? "release" : "releases"}
                        </p>
                        <h2 className="public-heading mt-4 text-3xl font-semibold">
                          {project.name}
                        </h2>
                        <p className="public-copy mt-4 line-clamp-5 text-sm leading-7">
                          {project.description}
                        </p>
                        <span className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-[#e3c16e]">
                          Explore {project.name}
                          <ArrowUpRight aria-hidden="true" size={15} />
                        </span>
                      </div>
                    </div>
                  </ProjectTrackedLink>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="public-panel px-5 py-10 text-center sm:px-8">
            <h2 className="public-heading text-2xl font-semibold">The projects are taking shape.</h2>
            <p className="public-copy mx-auto mt-3 max-w-xl text-sm leading-7">
              Explore the full catalog while the next recurring series is prepared.
            </p>
            <Link className="public-action-primary mt-6" href="/music">
              Explore music
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
