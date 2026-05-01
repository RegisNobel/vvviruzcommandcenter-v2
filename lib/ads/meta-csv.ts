import type {AdCreativeReportRecord} from "@/lib/types";

export type MetaMetricView = "delivery" | "engagement" | "video" | "unknown";

export type ParsedMetaAdRow = Omit<
  AdCreativeReportRecord,
  | "id"
  | "import_batch_id"
  | "release_id"
  | "linked_copy"
  | "performance_signals"
  | "created_at"
  | "updated_at"
> & {
  source_file: string;
  source_view: MetaMetricView;
};

export type ParsedMetaCsvFile = {
  fileName: string;
  columns: string[];
  rows: ParsedMetaAdRow[];
  warnings: string[];
};

const nullTokens = new Set(["", "-", "—", "–", "n/a", "na", "not available"]);

const fieldAliases: Record<string, keyof ParsedMetaAdRow> = {
  ad_name: "ad_name",
  ad: "ad_name",
  ad_set_name: "ad_set_name",
  adset_name: "ad_set_name",
  campaign_name: "campaign_name",
  campaign: "campaign_name",
  delivery: "ad_delivery",
  ad_delivery: "ad_delivery",
  reporting_starts: "reporting_start",
  reporting_start: "reporting_start",
  report_starts: "reporting_start",
  reporting_ends: "reporting_end",
  reporting_end: "reporting_end",
  report_ends: "reporting_end",
  amount_spent: "spend",
  amount_spent_usd: "spend",
  spent: "spend",
  spend: "spend",
  impressions: "impressions",
  reach: "reach",
  results: "results",
  cost_per_result: "cost_per_result",
  link_clicks: "link_clicks",
  cpc: "cpc",
  cost_per_link_click: "cpc",
  ctr: "ctr",
  ctr_link_click_through_rate: "ctr",
  link_ctr: "ctr",
  page_engagement: "page_engagement",
  post_reactions: "post_reactions",
  post_comments: "post_comments",
  post_saves: "post_saves",
  post_shares: "post_shares",
  instagram_follows: "instagram_follows",
  video_plays: "video_plays",
  video_play_actions: "video_plays",
  "3_second_video_plays": "three_second_plays",
  three_second_video_plays: "three_second_plays",
  thruplays: "thru_plays",
  thru_play: "thru_plays",
  thru_plays: "thru_plays",
  cost_per_thruplay: "cost_per_thru_play",
  cost_per_thru_play: "cost_per_thru_play",
  video_plays_at_25: "video_25",
  video_plays_at_25_percent: "video_25",
  video_plays_at_25_percentage: "video_25",
  video_plays_at_50: "video_50",
  video_plays_at_50_percent: "video_50",
  video_plays_at_50_percentage: "video_50",
  video_plays_at_75: "video_75",
  video_plays_at_75_percent: "video_75",
  video_plays_at_75_percentage: "video_75",
  video_plays_at_95: "video_95",
  video_plays_at_95_percent: "video_95",
  video_plays_at_95_percentage: "video_95",
  video_plays_at_100: "video_100",
  video_plays_at_100_percent: "video_100",
  video_plays_at_100_percentage: "video_100",
  quality_ranking: "quality_ranking",
  engagement_rate_ranking: "engagement_rate_ranking",
  conversion_rate_ranking: "conversion_rate_ranking",
  utm_source: "utm_source",
  utm_campaign: "utm_campaign",
  utm_content: "utm_content"
};

const numericFields = new Set<keyof ParsedMetaAdRow>([
  "spend",
  "impressions",
  "reach",
  "results",
  "cost_per_result",
  "link_clicks",
  "cpc",
  "ctr",
  "page_engagement",
  "post_reactions",
  "post_comments",
  "post_saves",
  "post_shares",
  "instagram_follows",
  "video_plays",
  "three_second_plays",
  "thru_plays",
  "cost_per_thru_play",
  "video_25",
  "video_50",
  "video_75",
  "video_95",
  "video_100"
]);

const integerFields = new Set<keyof ParsedMetaAdRow>([
  "impressions",
  "reach",
  "link_clicks",
  "page_engagement",
  "post_reactions",
  "post_comments",
  "post_saves",
  "post_shares",
  "instagram_follows",
  "video_plays",
  "three_second_plays",
  "thru_plays",
  "video_25",
  "video_50",
  "video_75",
  "video_95",
  "video_100"
]);

const deliveryTrustedFields = new Set<keyof ParsedMetaAdRow>([
  "campaign_name",
  "ad_set_name",
  "ad_delivery",
  "spend",
  "impressions",
  "reach",
  "results",
  "cost_per_result",
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking"
]);

const engagementTrustedFields = new Set<keyof ParsedMetaAdRow>([
  "link_clicks",
  "cpc",
  "ctr",
  "page_engagement",
  "post_reactions",
  "post_comments",
  "post_saves",
  "post_shares",
  "instagram_follows"
]);

const videoTrustedFields = new Set<keyof ParsedMetaAdRow>([
  "video_plays",
  "three_second_plays",
  "thru_plays",
  "cost_per_thru_play",
  "video_25",
  "video_50",
  "video_75",
  "video_95",
  "video_100"
]);

const videoViewHeaders = new Set([
  "video_plays",
  "video_play_actions",
  "3_second_video_plays",
  "three_second_video_plays",
  "thruplays",
  "thru_play",
  "thru_plays",
  "cost_per_thruplay",
  "cost_per_thru_play",
  "video_plays_at_25",
  "video_plays_at_25_percent",
  "video_plays_at_25_percentage",
  "video_plays_at_50",
  "video_plays_at_50_percent",
  "video_plays_at_50_percentage",
  "video_plays_at_75",
  "video_plays_at_75_percent",
  "video_plays_at_75_percentage",
  "video_plays_at_95",
  "video_plays_at_95_percent",
  "video_plays_at_95_percentage",
  "video_plays_at_100",
  "video_plays_at_100_percent",
  "video_plays_at_100_percentage"
]);

const engagementViewHeaders = new Set([
  "link_clicks",
  "cpc",
  "cost_per_link_click",
  "ctr",
  "ctr_link_click_through_rate",
  "link_ctr",
  "page_engagement",
  "post_reactions",
  "post_comments",
  "post_saves",
  "post_shares",
  "instagram_follows"
]);

const deliveryViewHeaders = new Set([
  "ad_set_name",
  "adset_name",
  "delivery",
  "ad_delivery",
  "amount_spent",
  "amount_spent_usd",
  "spent",
  "spend",
  "impressions",
  "reach",
  "results",
  "cost_per_result",
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking"
]);

function emptyRow(fileName: string, sourceView: MetaMetricView): ParsedMetaAdRow {
  return {
    source_file: fileName,
    source_view: sourceView,
    campaign_name: "",
    ad_set_name: "",
    ad_name: "",
    ad_delivery: "",
    reporting_start: null,
    reporting_end: null,
    spend: null,
    impressions: null,
    reach: null,
    results: null,
    cost_per_result: null,
    link_clicks: null,
    cpc: null,
    ctr: null,
    page_engagement: null,
    post_reactions: null,
    post_comments: null,
    post_saves: null,
    post_shares: null,
    instagram_follows: null,
    video_plays: null,
    three_second_plays: null,
    thru_plays: null,
    cost_per_thru_play: null,
    video_25: null,
    video_50: null,
    video_75: null,
    video_95: null,
    video_100: null,
    quality_ranking: "",
    engagement_rate_ranking: "",
    conversion_rate_ranking: "",
    utm_source: "",
    utm_campaign: "",
    utm_content: ""
  };
}

function detectMetricView(headers: string[]): MetaMetricView {
  if (headers.some((header) => videoViewHeaders.has(header))) {
    return "video";
  }

  if (headers.some((header) => engagementViewHeaders.has(header))) {
    return "engagement";
  }

  if (headers.some((header) => deliveryViewHeaders.has(header))) {
    return "delivery";
  }

  return "unknown";
}

export function normalizeMetaHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/%/g, " percent")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvRows(raw: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function parseNumber(value: string) {
  const normalized = value.trim().toLowerCase();

  if (nullTokens.has(normalized)) {
    return null;
  }

  const isNegative = /^\(.+\)$/.test(normalized);
  const cleaned = normalized.replace(/[,$%()\s]/g, "");
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return isNegative ? -parsed : parsed;
}

function parseInteger(value: string) {
  const parsed = parseNumber(value);

  return parsed === null ? null : Math.round(parsed);
}

function parseDate(value: string) {
  const normalized = value.trim();

  if (nullTokens.has(normalized.toLowerCase())) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseString(value: string) {
  const normalized = value.trim();

  return nullTokens.has(normalized.toLowerCase()) ? "" : normalized.slice(0, 1000);
}

function parseUtmParameters(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return {};
  }

  try {
    const params = new URLSearchParams(normalized.startsWith("?") ? normalized.slice(1) : normalized);

    return {
      utm_source: params.get("utm_source")?.trim() || "",
      utm_campaign: params.get("utm_campaign")?.trim() || "",
      utm_content: params.get("utm_content")?.trim() || ""
    };
  } catch {
    return {};
  }
}

function hasMergeValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function equivalentMergeValue(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.00001;
  }

  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function trustedFieldForView(view: MetaMetricView | undefined, field: keyof ParsedMetaAdRow) {
  if (view === "delivery") {
    return deliveryTrustedFields.has(field);
  }

  if (view === "engagement") {
    return engagementTrustedFields.has(field);
  }

  if (view === "video") {
    return videoTrustedFields.has(field);
  }

  return false;
}

function mergeSourceFiles(existing: string, incoming: string) {
  return Array.from(
    new Set(`${existing}, ${incoming}`.split(",").map((item) => item.trim()).filter(Boolean))
  ).join(", ");
}

function createFieldSources(row: ParsedMetaAdRow) {
  const sources: Partial<Record<keyof ParsedMetaAdRow, MetaMetricView>> = {};

  for (const key of Object.keys(row) as Array<keyof ParsedMetaAdRow>) {
    if (key !== "source_file" && key !== "source_view" && hasMergeValue(row[key])) {
      sources[key] = row.source_view;
    }
  }

  return sources;
}

function conflictMessage({
  field,
  existing,
  incoming,
  key
}: {
  field: keyof ParsedMetaAdRow;
  existing: unknown;
  incoming: unknown;
  key: string;
}) {
  return `Meta CSV merge conflict for ${field} on ${key}. Kept "${String(existing)}" over "${String(incoming)}".`;
}

export function normalizeMetaAdName(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getMetaMergeKey(row: ParsedMetaAdRow) {
  const adName = normalizeMetaAdName(row.ad_name);
  const reportingStart = row.reporting_start ?? "";
  const reportingEnd = row.reporting_end ?? "";

  return `${adName}|${reportingStart}|${reportingEnd}`;
}

export function mergeParsedMetaRows(
  rows: ParsedMetaAdRow[],
  options: {onConflict?: (message: string) => void} = {}
) {
  const merged = new Map<
    string,
    {
      row: ParsedMetaAdRow;
      fieldSources: Partial<Record<keyof ParsedMetaAdRow, MetaMetricView>>;
    }
  >();

  for (const incoming of rows) {
    const key = getMetaMergeKey(incoming);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        row: {...incoming},
        fieldSources: createFieldSources(incoming)
      });
      continue;
    }

    existing.row.source_file = mergeSourceFiles(existing.row.source_file, incoming.source_file);

    if (existing.row.source_view === "unknown" && incoming.source_view !== "unknown") {
      existing.row.source_view = incoming.source_view;
    }

    for (const field of Object.keys(incoming) as Array<keyof ParsedMetaAdRow>) {
      if (field === "source_file" || field === "source_view") {
        continue;
      }

      const incomingValue = incoming[field];
      const existingValue = existing.row[field];

      if (!hasMergeValue(existingValue) && hasMergeValue(incomingValue)) {
        (existing.row as Record<string, unknown>)[field] = incomingValue;
        existing.fieldSources[field] = incoming.source_view;
        continue;
      }

      if (!hasMergeValue(incomingValue) || !hasMergeValue(existingValue)) {
        continue;
      }

      if (equivalentMergeValue(existingValue, incomingValue)) {
        continue;
      }

      if (field === "ad_name" || field === "reporting_start" || field === "reporting_end") {
        continue;
      }

      if (field === "ad_set_name") {
        options.onConflict?.(
          conflictMessage({
            field,
            existing: existingValue,
            incoming: incomingValue,
            key
          })
        );
        continue;
      }

      const existingSource = existing.fieldSources[field] ?? existing.row.source_view;
      const incomingTrusted = trustedFieldForView(incoming.source_view, field);
      const existingTrusted = trustedFieldForView(existingSource, field);

      if (incomingTrusted && !existingTrusted) {
        (existing.row as Record<string, unknown>)[field] = incomingValue;
        existing.fieldSources[field] = incoming.source_view;
        continue;
      }

      options.onConflict?.(
        conflictMessage({
          field,
          existing: existingValue,
          incoming: incomingValue,
          key
        })
      );
    }
  }

  return Array.from(merged.values()).map((value) => value.row);
}

export function parseMetaCsv(fileName: string, raw: string): ParsedMetaCsvFile {
  const rows = parseCsvRows(raw.replace(/^\uFEFF/, ""));
  const warnings: string[] = [];

  if (rows.length < 2) {
    return {
      fileName,
      columns: rows[0] ?? [],
      rows: [],
      warnings: ["CSV file has no data rows."]
    };
  }

  const headers = rows[0].map(normalizeMetaHeader);
  const metricView = detectMetricView(headers);
  const parsedRows: ParsedMetaAdRow[] = [];

  for (const cells of rows.slice(1)) {
    const parsed = emptyRow(fileName, metricView);

    headers.forEach((header, index) => {
      const rawValue = cells[index] ?? "";
      const mappedField = fieldAliases[header];

      if (!mappedField) {
        if (header === "url_parameters" || header === "url_parameter") {
          Object.assign(parsed, parseUtmParameters(rawValue));
        }

        return;
      }

      if (mappedField === "reporting_start" || mappedField === "reporting_end") {
        parsed[mappedField] = parseDate(rawValue);
        return;
      }

      if (numericFields.has(mappedField)) {
        (parsed as Record<string, unknown>)[mappedField] = integerFields.has(mappedField)
          ? parseInteger(rawValue)
          : parseNumber(rawValue);
        return;
      }

      (parsed as Record<string, unknown>)[mappedField] = parseString(rawValue);
    });

    if (!parsed.ad_name.trim()) {
      warnings.push("Skipped row without Ad name.");
      continue;
    }

    parsedRows.push(parsed);
  }

  return {
    fileName,
    columns: rows[0],
    rows: mergeParsedMetaRows(parsedRows, {
      onConflict: (message) => warnings.push(message)
    }),
    warnings
  };
}
