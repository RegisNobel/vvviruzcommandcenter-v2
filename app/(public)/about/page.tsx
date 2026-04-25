export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";

import type {Metadata} from "next";

import {normalizeExternalUrl} from "@/lib/public-utils";
import {getSiteSettings} from "@/lib/repositories/public-site";
import {DEFAULT_SITE_ARTIST_IMAGE_FILE, getSiteIconUrl} from "@/lib/site-assets";

const ABOUT_SECTION_SURFACES = [
  "bg-[linear-gradient(145deg,rgba(201,163,71,0.12),rgba(15,18,23,0.94))]",
  "bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(15,18,23,0.96))]",
  "bg-[linear-gradient(145deg,rgba(201,163,71,0.08),rgba(12,15,19,0.96))]",
  "bg-[linear-gradient(145deg,rgba(255,255,255,0.04),rgba(13,16,20,0.95))]"
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();

  return {
    title: siteSettings.site_content.metadata.about_page_title,
    description: siteSettings.site_content.metadata.about_page_description
  };
}

function getSocialLogoFile(label: string, url: string) {
  const value = `${label} ${url}`.toLowerCase();

  if (value.includes("instagram")) {
    return "instagram.svg";
  }

  if (value.includes("tiktok")) {
    return "tiktok.svg";
  }

  if (value.includes("youtube")) {
    return "youtube-icon.svg";
  }

  if (
    value.includes("twitter") ||
    value.includes("x.com") ||
    value === "x" ||
    value.includes(" x ")
  ) {
    return "x.svg";
  }

  return null;
}

function getSocialAccentStyles(label: string, url: string) {
  const value = `${label} ${url}`.toLowerCase();

  if (value.includes("instagram")) {
    return {
      buttonClassName:
        "border-fuchsia-400/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(214,51,132,0.08))] hover:border-fuchsia-300/38 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(168,85,247,0.14))]",
      glowClassName:
        "bg-[radial-gradient(circle,rgba(244,114,182,0.2),rgba(168,85,247,0.12),transparent_72%)]",
      imageClassName: "brightness-0 invert"
    };
  }

  if (value.includes("tiktok")) {
    return {
      buttonClassName:
        "border-cyan-300/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(34,211,238,0.06),rgba(244,63,94,0.06))] hover:border-cyan-200/34 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(34,211,238,0.12),rgba(244,63,94,0.12))]",
      glowClassName:
        "bg-[radial-gradient(circle,rgba(34,211,238,0.18),rgba(244,63,94,0.12),transparent_74%)]",
      imageClassName: ""
    };
  }

  if (
    value.includes("twitter") ||
    value.includes("x.com") ||
    value === "x" ||
    value.includes(" x ")
  ) {
    return {
      buttonClassName:
        "border-white/14 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] hover:border-white/28 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))]",
      glowClassName: "bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_72%)]",
      imageClassName: ""
    };
  }

  if (value.includes("youtube")) {
    return {
      buttonClassName:
        "border-red-400/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(220,38,38,0.1))] hover:border-red-300/36 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(220,38,38,0.16))]",
      glowClassName: "bg-[radial-gradient(circle,rgba(248,113,113,0.2),transparent_72%)]",
      imageClassName: ""
    };
  }

  return {
    buttonClassName:
      "border-[#c9a347]/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(201,163,71,0.06))] hover:border-[#c9a347]/36 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(201,163,71,0.12))]",
    glowClassName: "bg-[radial-gradient(circle,rgba(201,163,71,0.18),transparent_72%)]",
    imageClassName: "brightness-0 invert"
  };
}

function createAboutNarrative(siteSettings: Awaited<ReturnType<typeof getSiteSettings>>) {
  const content = siteSettings.site_content.about;

  return [
    {
      id: "intro",
      title: content.intro_heading,
      text: content.intro_text.trim()
    },
    {
      id: "philosophy",
      title: content.philosophy_heading,
      text: content.philosophy_text.trim()
    },
    {
      id: "closing",
      title: content.closing_heading,
      text: content.closing_text.trim(),
      featured: true
    }
  ].filter((section) => section.text.trim());
}

export default async function PublicAboutPage() {
  const siteSettings = await getSiteSettings();
  const content = siteSettings.site_content.about;
  const aboutNarrative = createAboutNarrative(siteSettings).filter((section) =>
    ["intro", "philosophy", "closing"].includes(section.id)
  );
  const normalizedContactEmail = siteSettings.contact_email.trim();
  const contactEmail =
    !normalizedContactEmail || /^(coming soon|tbd|n\/a)$/i.test(normalizedContactEmail)
      ? content.contact_empty_text.trim() || "inquiry@vvviruz.com"
      : normalizedContactEmail;
  const artistStatement = content.statement_text.trim() || siteSettings.tagline.trim();
  const artistStatementLines = artistStatement
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] space-y-8">
        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#0f1217]/92 px-4 py-7 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(201,163,71,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_34%)]" />
          <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#c9a347]/10 blur-[130px]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-stretch">
            <div className="flex h-full items-center justify-center rounded-[30px] border border-white/10 bg-[#11151a]/80 p-4 sm:p-6 sm:p-8">
              <div className="w-full max-w-3xl rounded-[24px] border border-white/10 bg-black/20 px-5 py-5 text-center sm:px-8 sm:py-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8d949d]">
                  {content.statement_heading}
                </p>
                <div className="mt-3 space-y-2 text-lg leading-8 text-[#e7dfcf]">
                  {artistStatementLines.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative min-h-[320px] overflow-hidden rounded-[30px] border border-white/10 bg-[#12161c]">
              <Image
                alt={`${siteSettings.artist_name} portrait`}
                className="object-cover object-center opacity-88"
                fill
                priority
                sizes="(min-width: 1024px) 360px, 100vw"
                src={getSiteIconUrl(
                  content.artist_image_file || DEFAULT_SITE_ARTIST_IMAGE_FILE
                )}
                unoptimized
              />
            </div>
          </div>
        </section>

        <section className="rounded-[34px] border border-white/10 bg-[#0f1217]/92 px-4 py-7 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f1e6] sm:text-[2.2rem]">
              {content.narrative_heading}
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {aboutNarrative.map((section, index) => (
              <article
                className={`rounded-[28px] border border-white/10 px-5 py-6 sm:px-6 ${
                  ABOUT_SECTION_SURFACES[index % ABOUT_SECTION_SURFACES.length]
                } ${
                  section.id === "closing" ? "lg:col-span-2 text-center" : ""
                }`}
                key={section.id}
              >
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d2af5a] ${
                    section.id === "philosophy" ? "text-right" : ""
                  } ${section.id === "closing" ? "text-center" : ""}`}
                >
                  {section.title}
                </p>
                <div
                  className={`mt-4 h-px bg-white/10 ${
                    section.id === "philosophy"
                      ? "ml-auto w-full"
                      : section.id === "closing"
                        ? "mx-auto w-full max-w-xl"
                        : "w-full"
                  }`}
                />
                <p
                  className={`mt-5 text-base leading-8 text-[#d8e0e8] ${
                    section.id === "closing"
                      ? "mx-auto max-w-4xl text-center text-xl font-medium leading-9 text-[#f2e8d8]"
                      : ""
                  }`}
                >
                  {section.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0f1217]/92 px-6 py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_42%),linear-gradient(180deg,rgba(201,163,71,0.04),transparent_55%)]" />
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#f7f1e6] sm:text-[2rem]">
              {content.connect_heading}
            </h2>
          </div>

          {siteSettings.social_links.length > 0 ? (
            <div className="relative mt-8">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,163,71,0.12),transparent_72%)] blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              {siteSettings.social_links.map((socialLink) => {
                const socialLogoFile = getSocialLogoFile(socialLink.label, socialLink.url);
                const accent = getSocialAccentStyles(socialLink.label, socialLink.url);

                return (
                  <Link
                    aria-label={socialLink.label}
                    className={`group relative inline-flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center overflow-hidden rounded-[24px] border text-center text-[#f4eedf] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition duration-300 hover:scale-[1.05] ${accent.buttonClassName}`}
                    href={normalizeExternalUrl(socialLink.url)}
                    key={socialLink.id}
                    rel="noreferrer"
                    target="_blank"
                    title={socialLink.label}
                  >
                    <span
                      className={`pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 ${accent.glowClassName}`}
                    />
                    {socialLogoFile ? (
                      <span className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center">
                        <Image
                          alt={socialLink.label}
                          className={`max-h-8 sm:max-h-9 w-auto object-contain opacity-90 transition duration-300 group-hover:opacity-100 ${accent.imageClassName}`.trim()}
                          height={36}
                          src={getSiteIconUrl(socialLogoFile)}
                          unoptimized
                          width={36}
                        />
                      </span>
                    ) : (
                      <span className="text-sm font-semibold tracking-[0.18em] text-[#efe7d8]">
                        {socialLink.label}
                      </span>
                    )}
                  </Link>
                );
              })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-center text-sm leading-7 text-[#98a0a8]">
              {content.connect_empty_text}
            </p>
          )}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-[#0f1217]/92 px-6 py-7">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm leading-7 text-[#b3bbc5]">
              {content.contact_microcopy}
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-xl rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(201,163,71,0.12),rgba(15,18,23,0.96))] px-5 py-5 text-center">
            <Link
              className="inline-flex justify-center text-lg font-semibold text-[#f2e4be] transition hover:text-[#ffdfa0]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

