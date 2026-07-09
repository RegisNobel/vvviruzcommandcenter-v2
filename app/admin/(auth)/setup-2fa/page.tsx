import {QrCode} from "lucide-react";

import {
  ensureTotpEnrollmentForSession,
  requirePendingAdminSession
} from "@/lib/auth/server";

const errorMessages: Record<string, string> = {
  "invalid-code": "That code did not verify. Try the current 6-digit code again.",
  "session-expired": "Your login session expired. Start again."
};

export default async function AdminSetupTotpPage({
  searchParams
}: {
  searchParams: Promise<{error?: string}>;
}) {
  const [{error}, session] = await Promise.all([
    searchParams,
    requirePendingAdminSession("setup-totp")
  ]);
  const enrollment = await ensureTotpEnrollmentForSession(session);

  return (
    <main className="space-y-6">
      <section className="panel overflow-hidden px-6 py-7 sm:px-8">
        <div className="pill">
          <QrCode size={12} />
          Set up TOTP
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink">
          Enroll your authenticator app
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Add this account to your authenticator app, then enter the current 6-digit
          code to finish admin setup.
        </p>

        {error ? (
          <div className="mt-5 rounded-md border border-[rgba(223,107,107,0.4)] bg-[var(--status-danger-soft)] px-4 py-3 text-sm text-[#f0b4b4]">
            {errorMessages[error] ?? "Two-factor setup failed."}
          </div>
        ) : null}

        <div className="mt-6 space-y-4 rounded-xl border border-edge bg-surface-elevated p-5">
          <div>
            <p className="field-label">Issuer</p>
            <p className="mt-2 text-sm font-semibold text-ink">{enrollment.issuer}</p>
          </div>

          <div>
            <p className="field-label">Manual secret</p>
            <div className="mt-2 rounded-md border border-edge-strong bg-input px-4 py-3 font-mono text-sm text-ink">
              {enrollment.secret}
            </div>
          </div>

          <div>
            <p className="field-label">otpauth URL</p>
            <p className="mt-2 break-all text-xs leading-6 text-muted">
              {enrollment.otpauthUrl}
            </p>
          </div>
        </div>

        <form action="/api/auth/setup-totp" className="mt-6 space-y-4" method="post">
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
            Finish setup and enter admin
          </button>
        </form>
      </section>
    </main>
  );
}
