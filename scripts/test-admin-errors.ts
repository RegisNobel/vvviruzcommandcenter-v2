import assert from "node:assert/strict";

import {
  AdminRequestError,
  readAdminApiResponse
} from "../lib/admin-errors";

async function expectAdminError(
  response: Response,
  expected: {
    code: string;
    message: string;
    requestId?: string;
  }
) {
  await assert.rejects(
    () => readAdminApiResponse(response, "The fallback message."),
    (error: unknown) => {
      assert.ok(error instanceof AdminRequestError);
      assert.equal(error.code, expected.code);
      assert.equal(error.message, expected.message);
      assert.equal(error.requestId, expected.requestId);
      return true;
    }
  );
}

async function main() {
  const success = await readAdminApiResponse<{ok: boolean}>(
    new Response(JSON.stringify({ok: true}), {
      headers: {"content-type": "application/json"},
      status: 200
    })
  );
  assert.equal(success.ok, true);

  const emptySuccess = await readAdminApiResponse<Record<string, never>>(
    new Response(null, {status: 204})
  );
  assert.deepEqual(emptySuccess, {});

  await expectAdminError(
    new Response(JSON.stringify({message: "Choose a different slug."}), {
      status: 409
    }),
    {
      code: "CONFLICT",
      message: "Choose a different slug."
    }
  );

  await expectAdminError(
    new Response(
      JSON.stringify({
        error: {
          code: "STORAGE",
          message: "The artwork could not be stored.",
          requestId: "request-storage-1",
          retryable: true
        }
      }),
      {status: 500}
    ),
    {
      code: "STORAGE",
      message: "The artwork could not be stored.",
      requestId: "request-storage-1"
    }
  );

  await expectAdminError(
    new Response(null, {
      headers: {"x-request-id": "request-empty-1"},
      status: 500
    }),
    {
      code: "UNKNOWN",
      message: "The fallback message.",
      requestId: "request-empty-1"
    }
  );

  await expectAdminError(
    new Response("<html>deployment error</html>", {
      headers: {"x-request-id": "request-html-1"},
      status: 502
    }),
    {
      code: "UNREADABLE_RESPONSE",
      message:
        "The server returned an unreadable response. Try again, and check the deployment logs if the problem continues.",
      requestId: "request-html-1"
    }
  );

  console.log("Admin error contract checks passed.");
}

void main();
