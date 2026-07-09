import Link from "next/link";

import {getSiteSettings} from "@/lib/repositories/public-site";

export default async function PublicReleaseNotFound() {
  const siteSettings = await getSiteSettings();
  const content = siteSettings.site_content.release;

  return (
    <main className="public-page-wrap">
      <div className="mx-auto max-w-[840px]">
        <section className="public-panel px-6 py-10 text-center sm:px-8 sm:py-12">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#f7f1e6] sm:text-5xl">
            {content.not_found_heading}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#98a0a8] sm:text-base">
            {content.not_found_body}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              className="public-action-secondary"
              href="/music"
            >
              {content.back_to_music_label}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
