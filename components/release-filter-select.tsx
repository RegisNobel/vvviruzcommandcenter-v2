"use client";

import { useRouter } from "next/navigation";

export function ReleaseFilterSelect({
  releases,
  activeReleaseId
}: {
  releases: Array<{ id: string; title: string }>;
  activeReleaseId: string | null;
}) {
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const val = event.target.value;
    if (val) {
      router.push(`/admin/ad-lab?releaseId=${encodeURIComponent(val)}`);
    } else {
      router.push("/admin/ad-lab");
    }
  }

  return (
    <div className="w-full max-w-xs">
      <select
        className="field-input w-full"
        onChange={handleChange}
        value={activeReleaseId || ""}
      >
        <option value="">All Releases</option>
        {releases.map((release) => (
          <option key={release.id} value={release.id}>
            {release.title}
          </option>
        ))}
      </select>
    </div>
  );
}
