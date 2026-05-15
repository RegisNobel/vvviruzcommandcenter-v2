export const dynamic = "force-dynamic";

import Link from "next/link";
import {redirect} from "next/navigation";
import type {Metadata} from "next";
import {Box, Disc, FileAudio, Star} from "lucide-react";

import {readSiteSettings} from "@/lib/repositories/site-settings";
import {VaultPageAnalytics} from "@/components/vault-page-analytics";

const BENEFIT_MARKERS = [Disc, FileAudio, Box, Star];

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSiteSettings();

  return {
    title: settings.site_content.vault.title || "The Vault EP",
    description: settings.site_content.vault.subtitle || "Premium digital-only bundle"
  };
}

export default async function PublicVaultPage() {
  const settings = await readSiteSettings();
  const vault = settings.site_content.vault;

  if (!vault.is_enabled) {
    redirect("/exclusives");
  }

  const benefits = vault.benefits.filter(
    (b) => b.title.trim() || b.description.trim()
  );

  return (
    <main className="relative min-h-[calc(100vh-140px)] overflow-hidden bg-[#06080b] px-4 py-10 sm:px-6 sm:py-16">
      <VaultPageAnalytics />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.18),transparent_33%),linear-gradient(180deg,rgba(5,6,9,0.96),rgba(7,9,13,1))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.024)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[length:52px_52px] opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-[#c9a347]/10 blur-[90px]" />

      <div className="relative mx-auto max-w-[1160px]">
        <section className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[42px] border border-white/10 bg-[#0c1015]/82 px-5 py-12 text-center shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:px-8 sm:py-16 lg:px-12">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(201,163,71,0.72),transparent)]" />
          
          <div className="inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d7b663]">
            {vault.badge_text}
          </div>

          <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-bold tracking-tight text-[#f7f1e6] sm:text-6xl">
            {vault.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-[#e8dcc3] sm:text-xl">
            {vault.subtitle}
          </p>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-[#a7b0ba] sm:text-lg">
            {vault.body}
          </p>

          <div className="mt-10 flex justify-center">
            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#c9a347]/36 bg-[#c9a347] px-8 py-4 text-sm font-semibold text-[#13161a] transition hover:scale-[1.01] hover:bg-[#d8b761] sm:w-auto"
              data-analytics-event="vault_cta_click"
              href={vault.cta_url || "/exclusives"}
            >
              {vault.cta_label}
            </Link>
          </div>
        </section>

        {benefits.length > 0 ? (
          <section className="relative mx-auto mt-12 max-w-[1120px]">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit, index) => {
                const Marker = BENEFIT_MARKERS[index % BENEFIT_MARKERS.length];

                return (
                  <article
                    className="group relative overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(9,12,17,0.76))] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#c9a347]/45 hover:shadow-[0_20px_60px_rgba(201,163,71,0.12)]"
                    key={benefit.id || index}
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#c9a347]/0 blur-2xl transition group-hover:bg-[#c9a347]/12" />
                    <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-[#d7b663] transition group-hover:border-[#c9a347]/35 group-hover:bg-[#c9a347]/10">
                      <Marker size={20} />
                    </div>
                    <h3 className="relative text-lg font-semibold leading-7 text-[#f7f1e6]">
                      {benefit.title}
                    </h3>
                    <p className="relative mt-3 text-sm leading-7 text-[#a7b0ba]">
                      {benefit.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
