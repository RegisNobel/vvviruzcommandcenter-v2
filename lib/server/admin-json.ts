import "server-only";

import {AdminError} from "./admin-error-response";

export async function readLimitedAdminJson(request: Request, maxBytes = 32 * 1024) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new AdminError("Request body is too large.", {code: "VALIDATION", status: 413});
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) throw new AdminError("Request body is too large.", {code: "VALIDATION", status: 413});
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AdminError("Request body must contain valid JSON.", {code: "VALIDATION", status: 400});
  }
}
