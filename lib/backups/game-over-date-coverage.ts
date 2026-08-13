export type TrackDateCoverage = {
  observation_count: number;
  distinct_date_count: number;
  duplicate_date_count: number;
  missing_date_count: number;
  earliest_date: string | null;
  latest_date: string | null;
};

type QueryClient = {
  query<T>(sql: string, values: readonly unknown[]): Promise<{rows: T[]}>;
};

export const TRACK_DATE_COVERAGE_SQL = `
  WITH observations AS MATERIALIZED (
    SELECT o."metricDate"::date metric_date
    FROM "TrackMetricObservation" o
    WHERE o."importId"=$1
  ), expected_dates AS (
    SELECT expected_date::date
    FROM generate_series($2::date,$3::date,interval '1 day') expected_date
  )
  SELECT
    count(*)::int observation_count,
    count(DISTINCT metric_date)::int distinct_date_count,
    (count(*)-count(DISTINCT metric_date))::int duplicate_date_count,
    (SELECT count(*)::int
      FROM expected_dates expected
      WHERE NOT EXISTS (
        SELECT 1
        FROM observations actual
        WHERE actual.metric_date=expected.expected_date
      )) missing_date_count,
    to_char(min(metric_date),'YYYY-MM-DD') earliest_date,
    to_char(max(metric_date),'YYYY-MM-DD') latest_date
  FROM observations`;

export async function readTrackDateCoverage(
  db: QueryClient,
  importId: string,
  expectedEarliestDate: string,
  expectedLatestDate: string
): Promise<TrackDateCoverage> {
  const result = await db.query<TrackDateCoverage>(TRACK_DATE_COVERAGE_SQL, [
    importId,
    expectedEarliestDate,
    expectedLatestDate
  ]);
  if (result.rows.length !== 1) throw new Error("Track date coverage query returned an invalid result.");
  return result.rows[0];
}

const gameOverDateCoverage = {readTrackDateCoverage, TRACK_DATE_COVERAGE_SQL};

export default gameOverDateCoverage;
