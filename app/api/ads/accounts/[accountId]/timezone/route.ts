export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {NextResponse} from "next/server";

import {confirmMetaAccountTimezone, readCurrentMetaAccountTimezone} from "@/lib/ads/meta-account-timezones";
import {requireAuthenticatedApiRequest} from "@/lib/auth/server";
import {adminErrorResponse} from "@/lib/server/admin-error-response";
import {readLimitedAdminJson} from "@/lib/server/admin-json";

type Context = {params: Promise<{accountId: string}>};

export async function GET(request: Request, {params}: Context) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try {
    const item = await readCurrentMetaAccountTimezone(decodeURIComponent((await params).accountId));
    return NextResponse.json({item: item ? {accountId: item.accountId, timezone: item.ianaTimezone, sourceOrigin: item.sourceOrigin, confirmedAt: item.confirmedAt, confirmedByUsername: item.confirmedByUsername} : null});
  } catch (error) { return adminErrorResponse(error, {context: "ad-lab.account-timezone.read", fallbackMessage: "The reviewed Meta account timezone could not be loaded."}); }
}

export async function POST(request: Request, {params}: Context) {
  const auth = await requireAuthenticatedApiRequest(request); if (auth instanceof Response) return auth;
  try {
    const body = await readLimitedAdminJson(request) as Record<string, unknown>;
    const result = await confirmMetaAccountTimezone({
      accountId: decodeURIComponent((await params).accountId), timezone: String(body.timezone ?? ""), sourceOrigin: "USER_CONFIRMED",
      replaceCurrent: body.replaceCurrent === true, reason: String(body.reason ?? ""), actor: {userId: auth.userId, username: auth.username}
    });
    return NextResponse.json({item: {accountId: result.accountId, timezone: result.ianaTimezone, sourceOrigin: result.sourceOrigin, confirmedAt: result.confirmedAt, confirmedByUsername: result.confirmedByUsername}});
  } catch (error) { return adminErrorResponse(error, {context: "ad-lab.account-timezone.confirm", fallbackMessage: "The Meta account timezone could not be confirmed.", exposeMessage: true}); }
}
