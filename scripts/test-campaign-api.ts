import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const routeFiles = ["app/api/analytics/campaigns/route.ts", "app/api/analytics/campaigns/[id]/route.ts", "app/api/analytics/campaigns/[id]/intervals/route.ts", "app/api/analytics/campaigns/[id]/intervals/[intervalId]/route.ts", "app/api/analytics/campaigns/[id]/intervals/[intervalId]/confirm/route.ts", "app/api/analytics/campaigns/[id]/intervals/[intervalId]/reject/route.ts", "app/api/analytics/campaigns/[id]/events/route.ts", "app/api/analytics/campaigns/[id]/events/[eventId]/route.ts", "app/api/analytics/campaigns/[id]/suggestions/route.ts"];
for (const file of routeFiles) { const content = source(file); assert.ok(content.includes("requireAuthenticatedApiRequest"), `${file} requires protected admin auth`); assert.ok(content.includes("adminErrorResponse"), `${file} returns stable errors`); if (/POST|PATCH/.test(content) && !file.endsWith("suggestions/route.ts")) assert.ok(content.includes("readLimitedAdminJson"), `${file} limits mutation bodies`); }
const service = source("lib/analytics/campaign-timeline-service.ts"); for (const code of ["CAMPAIGN_NOT_FOUND","CAMPAIGN_RELEASE_REQUIRED","CAMPAIGN_ARTIST_MISMATCH","CAMPAIGN_INTERVAL_NOT_FOUND","CAMPAIGN_INTERVAL_INVALID","CAMPAIGN_INTERVAL_OVERLAP","CAMPAIGN_OPEN_INTERVAL_EXISTS","CAMPAIGN_INTERVAL_NOT_CONFIRMED","CAMPAIGN_SUGGESTION_NOT_FOUND","CAMPAIGN_SUGGESTION_ALREADY_RESOLVED","CAMPAIGN_EVENT_INVALID","CAMPAIGN_TIMEZONE_REQUIRED","CAMPAIGN_CONFLICT","CAMPAIGN_ARCHIVED","CAMPAIGN_REASON_REQUIRED"]) assert.ok(service.includes(code), `service exposes ${code}`);
assert.ok(!source("components/campaign-timeline-editor.tsx").includes("AdCreativeReport"), "client editor does not expose raw Meta rows");
console.log("Campaign API authorization, body-limit, stable-error, and exposure checks passed.");
