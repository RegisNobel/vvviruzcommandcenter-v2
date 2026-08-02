import Link from "next/link";
import {ArrowUpRight} from "lucide-react";

import {parseCollaborators} from "@/lib/public-utils";

export function PublicCollaboratorCredits({
  collaboratorName,
  profiles,
  className = ""
}: {
  collaboratorName: string;
  profiles: Array<{name: string; slug: string}>;
  className?: string;
}) {
  const names = parseCollaborators(collaboratorName);
  if (!names.length) return null;

  return (
    <span className={className}>
      with{" "}
      {names.map((name, index) => {
        const profile = profiles.find(
          (candidate) => candidate.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        const separator = index === 0 ? "" : index === names.length - 1 ? " & " : ", ";
        return (
          <span className="min-w-0" key={`${name}-${index}`}>
            {separator}
            {profile ? (
              <Link
                aria-label={`Open ${name} artist profile`}
                className="group/artist-link inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-[#d8b95f]/35 bg-[#d8b95f]/10 px-2 py-0.5 font-semibold text-[#f0cd74] no-underline shadow-[0_0_0_rgba(216,185,95,0)] transition hover:-translate-y-px hover:border-[#f0cd74]/70 hover:bg-[#d8b95f]/20 hover:text-[#fff3c9] hover:shadow-[0_6px_18px_rgba(216,185,95,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0cd74]/70"
                href={`/artists/${profile.slug}`}
              >
                <span className="min-w-0 truncate">{name}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="shrink-0 transition-transform group-hover/artist-link:-translate-y-0.5 group-hover/artist-link:translate-x-0.5"
                  size={11}
                  strokeWidth={2.4}
                />
              </Link>
            ) : name}
          </span>
        );
      })}
    </span>
  );
}
