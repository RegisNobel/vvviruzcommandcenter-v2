import Link from "next/link";
import {getSiteSettings} from "@/lib/repositories/public-site";

export default async function PublicProjectNotFound() {
  const siteSettings = await getSiteSettings();
  const content = siteSettings.site_content.projects;

  return (
    <main className="public-page-wrap">
      <section className="public-panel px-5 py-12 text-center sm:px-8">
        <p className="public-eyebrow">{content.not_found_eyebrow}</p>
        <h1 className="public-heading mt-4 text-4xl font-semibold">{content.not_found_heading}</h1>
        <p className="public-copy mx-auto mt-4 max-w-xl text-sm leading-7">
          {content.not_found_description}
        </p>
        <Link className="public-action-primary mt-7" href="/music">
          {content.not_found_cta_label}
        </Link>
      </section>
    </main>
  );
}
