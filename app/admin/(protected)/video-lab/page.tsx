import {readRelease} from "@/lib/server/releases";
import {LyricLabStudio} from "@/components/lyric-lab-studio";

export default async function AdminVideoLabPage({
  searchParams
}: {
  searchParams: Promise<{projectId?: string; releaseId?: string}>;
}) {
  const {projectId, releaseId} = await searchParams;
  let initialReleaseId: string | null = null;

  if (!projectId && releaseId) {
    try {
      await readRelease(releaseId);
      initialReleaseId = releaseId;
    } catch {
      initialReleaseId = null;
    }
  }

  return (
    <LyricLabStudio
      initialProjectId={projectId ?? null}
      initialReleaseId={initialReleaseId}
    />
  );
}
