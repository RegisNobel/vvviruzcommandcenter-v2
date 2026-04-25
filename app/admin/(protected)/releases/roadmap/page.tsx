export const dynamic = "force-dynamic";

import {ReleaseRoadmap} from "@/components/release-roadmap";
import {readReleaseYearRoadmap} from "@/lib/server/releases";

type RoadmapSearchParams = {
  year?: string | string[];
};

function parseRoadmapYear(value: RoadmapSearchParams["year"]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsedYear = Number(rawValue);

  if (Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
    return parsedYear;
  }

  return new Date().getFullYear();
}

export default async function AdminReleaseRoadmapPage({
  searchParams
}: {
  searchParams: Promise<RoadmapSearchParams>;
}) {
  const params = await searchParams;
  const year = parseRoadmapYear(params.year);
  const releases = await readReleaseYearRoadmap(year);

  return <ReleaseRoadmap releases={releases} year={year} />;
}
