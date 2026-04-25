import {redirect} from "next/navigation";

export default async function AdminLyricLabPage({
  searchParams
}: {
  searchParams: Promise<{projectId?: string; releaseId?: string}>;
}) {
  const {projectId, releaseId} = await searchParams;
  const nextSearchParams = new URLSearchParams();

  if (projectId) {
    nextSearchParams.set("projectId", projectId);
  }

  if (releaseId) {
    nextSearchParams.set("releaseId", releaseId);
  }

  redirect(
    `/admin/video-lab${
      nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : ""
    }`
  );
}
