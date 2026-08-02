export const dynamic = "force-dynamic";

import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft} from "lucide-react";

import {BreakingBarzSubmissionForm} from "@/components/breaking-barz-submission-form";
import {readSiteSettings} from "@/lib/repositories/site-settings";

export const metadata: Metadata = {
  title: "Suggest a bar",
  description: "Suggest song lines for a future Breaking Barz breakdown.",
  robots: {index: false, follow: true}
};

export default async function BreakingBarzSuggestPage() {
  const settings = await readSiteSettings();
  const feature = settings.site_content.breaking_barz;
  if (!feature.is_enabled || !feature.submissions_enabled) notFound();

  return (
    <main className="public-page-wrap">
      <div className="mx-auto max-w-3xl">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#e3c16e]" href="/breaking-barz">
          <ArrowLeft aria-hidden="true" size={16} /> Back to Breaking Barz
        </Link>
        <section className="mt-6 mb-6">
          <p className="public-eyebrow">Fan suggestions</p>
          <h1 className="public-heading mt-4 text-4xl font-semibold sm:text-5xl">Suggest a bar</h1>
          <p className="public-copy mt-4 max-w-2xl text-sm leading-7 sm:text-base">
            Send a couple of lines from any song. You can add your interpretation, but every suggestion is reviewed before anything is published.
          </p>
        </section>
        <BreakingBarzSubmissionForm />
      </div>
    </main>
  );
}
