import {KeyRound} from "lucide-react";

import {requirePendingAdminSession} from "@/lib/auth/server";

const errorMessages: Record<string, string> = {
  "invalid-code": "Invalid verification code.",
  throttled: "Too many verification attempts. Try again shortly.",
  "session-expired": "Your login session expired. Start again."
};

export default async function AdminTotpPage({
  searchParams
}: {
  searchParams: Promise<{error?: string}>;
}) {
  const [{error}, session] = await Promise.all([
    searchParams,
    requirePendingAdminSession("pending-totp")
  ]);

  return (
    <main className="space-y-6">
      <section className="panel overflow-hidden px-6 py-7 sm:px-8">
        <div className="pill">
          <KeyRound size={12} />
          Two-factor challenge
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink">
          Enter your authenticator code
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Finish signing in as <span className="font-semibold text-ink">{session.username}</span>.
        </p>

        {error ? (
          <div className="mt-5 rounded-md border border-[rgba(223,107,107,0.4)] bg-[var(--status-danger-soft)] px-4 py-3 text-sm text-[#f0b4b4]">
            {errorMessages[error] ?? "Verification failed."}
          </div>
        ) : null}

        <form action="/api/auth/totp" className="mt-6 space-y-4" method="post">
          <label className="block space-y-2">
            <span className="field-label">Authenticator code</span>
            <input
              autoComplete="one-time-code"
              className="field-input"
              inputMode="numeric"
              maxLength={6}
              name="code"
              pattern="[0-9]{6}"
              placeholder="123456"
              required
              type="text"
            />
          </label>

          <button className="action-button-primary w-full" type="submit">
            Verify and enter admin
          </button>
        </form>
      </section>
    </main>
  );
}
