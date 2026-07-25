"use client";

import { useRouter } from "next/navigation";

import {ReleasePicker} from "@/components/release-picker";

export function ReleaseFilterSelect({
  releases,
  activeReleaseId
}: {
  releases: Array<{ id: string; title: string }>;
  activeReleaseId: string | null;
}) {
  const router = useRouter();

  function handleChange(val: string) {
    if (val) {
      router.push(`/admin/ad-lab?releaseId=${encodeURIComponent(val)}`);
    } else {
      router.push("/admin/ad-lab");
    }
  }

  return (
    <div className="w-full max-w-xs">
      <ReleasePicker
        ariaLabel="Filter Ad Lab by release"
        emptyOption={{label: "All Releases", value: ""}}
        onValueChange={handleChange}
        releases={releases}
        value={activeReleaseId || ""}
      />
    </div>
  );
}
