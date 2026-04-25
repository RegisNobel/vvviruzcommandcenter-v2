import Link from "next/link";

import {getSiteSettings} from "@/lib/repositories/public-site";

export default async function PublicReleaseNotFound() {
  const siteSettings = await getSiteSettings();
  const content = siteSettings.site_content.release;

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[840px]">
        <section className="rounded-[34px] border border-white/10 bg-[#0f1217]/92 px-6 py-10 text-center sm:px-8">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#f7f1e6] sm:text-5xl">
            {content.not_found_heading}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#98a0a8] sm:text-base">
            {content.not_found_body}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-[#f4eedf] transition hover:border-[#c9a347]/40 hover:bg-[#c9a347]/10"
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
