import Link from "next/link";

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
          <span key={`${name}-${index}`}>
            {separator}
            {profile ? (
              <Link className="underline decoration-current/40 underline-offset-4 hover:text-white" href={`/artists/${profile.slug}`}>
                {name}
              </Link>
            ) : name}
          </span>
        );
      })}
    </span>
  );
}
