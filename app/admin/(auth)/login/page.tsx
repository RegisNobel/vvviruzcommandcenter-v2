import {LockKeyhole, ShieldCheck} from "lucide-react";
import {redirect} from "next/navigation";

import {getAdminAccessState} from "@/lib/auth/server";

const errorMessages: Record<string, string> = {
  "invalid-login": "Invalid username or password.",
  throttled: "Too many login attempts. Try again shortly.",
  "session-expired": "Your session expired. Sign in again.",
  "auth-config": "Admin auth is not configured yet."
};

const infoMessages: Record<string, string> = {
  "signed-out": "You have been signed out."
};

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{error?: string; message?: string}>;
}) {
  const [{error, message}, access] = await Promise.all([searchParams, getAdminAccessState()]);

  if (access.stage === "authenticated") {
    redirect("/admin/releases");
  }

  if (access.stage === "pending-totp") {
    redirect("/admin/2fa");
  }

  if (access.stage === "setup-totp") {
    redirect("/admin/setup-2fa");
  }

  return (
    <main className="space-y-6">
      <section className="panel overflow-hidden px-6 py-7 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="pill">
            <ShieldCheck size={12} />
            Admin access
          </div>
          <div className="pill">
            <LockKeyhole size={12} />
            Username + password + TOTP
          </div>
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink">
          Sign in to vvviruz&apos; admin
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This private command center is protected behind a server-enforced admin
          boundary.
        </p>

        {error ? (
          <div className="mt-5 rounded-md border border-[rgba(223,107,107,0.4)] bg-[var(--status-danger-soft)] px-4 py-3 text-sm text-[#f0b4b4]">
            {errorMessages[error] ?? "Sign in failed."}
          </div>
        ) : null}

        {!error && message ? (
          <div className="mt-5 rounded-md border border-[rgba(79,191,136,0.34)] bg-[var(--status-success-soft)] px-4 py-3 text-sm text-[#9de2bd]">
            {infoMessages[message] ?? message}
          </div>
        ) : null}

        <form action="/api/auth/login" className="mt-6 space-y-4" method="post">
          <label className="block space-y-2">
            <span className="field-label">Username</span>
            <input
              autoComplete="username"
              className="field-input"
              name="username"
              placeholder="Admin username"
              required
              type="text"
            />
          </label>

          <label className="block space-y-2">
            <span className="field-label">Password</span>
            <input
              autoComplete="current-password"
              className="field-input"
              name="password"
              placeholder="Password"
              required
              type="password"
            />
          </label>

          <button className="action-button-primary w-full" type="submit">
            Continue to verification
          </button>
        </form>
      </section>
    </main>
  );
}
