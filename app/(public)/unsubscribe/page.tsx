export const dynamic = "force-dynamic";

import Link from "next/link";
import type {Metadata} from "next";

import {unsubscribeSubscriberByToken} from "@/lib/repositories/audience";
import {getSiteSettings} from "@/lib/repositories/public-site";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();

  return {
    title: "Unsubscribe",
    description: "Manage your vvviruz email subscription preferences."
  };
}

export default async function UnsubscribePage({
  searchParams
}: {
  searchParams: Promise<{token?: string}>;
}) {
  const siteSettings = await getSiteSettings();
  const params = await searchParams;
  const token = params.token?.trim();
  const subscriber = token ? await unsubscribeSubscriberByToken(token) : null;
  const isValid = Boolean(subscriber);

  return (
    <main className="public-page-wrap">
      <div className="mx-auto max-w-[640px]">
        <section className="public-panel px-6 py-10 text-center sm:px-8 sm:py-12">
          <div className="public-eyebrow inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[#d7b663]">
            Email Preferences
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-[#f7f1e6] sm:text-[2.5rem]">
            {isValid ? "You’re unsubscribed." : "Invalid unsubscribe link"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#b7c0c9] sm:text-base">
            {isValid
              ? `${subscriber?.email} will no longer receive vvviruz campaign emails.`
              : "This unsubscribe link is missing or no longer valid."}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              className="public-action-secondary"
              href="/"
            >
              Return to {siteSettings.artist_name}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
