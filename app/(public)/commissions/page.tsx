export const dynamic = "force-dynamic";

import {type Metadata} from "next";
import {CommissionRequestForm} from "@/components/commission-request-form";
import {Sparkles, Mic, Music, Users} from "lucide-react";
import {readSiteSettings} from "@/lib/repositories/site-settings";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await readSiteSettings();
  const commissions = siteSettings.site_content.commissions;
  const description = commissions.is_enabled
    ? commissions.metadata_open_description
    : commissions.metadata_closed_description;

  return {
    title: commissions.metadata_title,
    description,
    alternates: {canonical: "/commissions"},
    openGraph: {
      type: "website",
      title: commissions.metadata_title,
      description,
      url: "/commissions"
    }
  };
}

export default async function CommissionsPage() {
  const siteSettings = await readSiteSettings();
  const commissions = siteSettings.site_content.commissions;

  if (!commissions.is_enabled) {
    return (
      <main className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-[#050609] px-5 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.08),transparent_40%),linear-gradient(180deg,rgba(5,6,9,0.96),rgba(7,9,13,1))]" />
        <div className="relative max-w-xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.03] border border-white/5 text-[#c9a347]/40 mb-8">
            <Mic size={32} />
          </div>
          <p className="public-eyebrow text-[#d7b663]">{commissions.closed_eyebrow}</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#f7f1e6] sm:text-4xl">
            {commissions.closed_heading}
          </h1>
          <p className="mt-4 text-lg text-[#b6bec7] max-w-md mx-auto">
            {commissions.closed_message}
          </p>
          <Link 
            href="/music"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-[#c9a347] px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-[#d7b663]"
          >
            {commissions.closed_cta_label}
          </Link>
        </div>
      </main>
    );
  }

  const serviceIcons = [Mic, Music, Users];

  return (
    <main className="public-conversion-shell min-h-[100dvh]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.08),transparent_40%),linear-gradient(180deg,rgba(5,6,9,0.96),rgba(7,9,13,1))]" />
      
      <div className="relative mx-auto max-w-5xl py-8 sm:py-12">
        {/* Hero Section */}
        <div className="public-hero public-panel text-center">
          <p className="public-eyebrow inline-flex items-center gap-2 text-[#d7b663]">
            <Sparkles size={14} />
            {commissions.page_eyebrow}
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[#f7f1e6] sm:text-5xl">
            {commissions.page_title || "Request custom work from vvviruz."}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#b6bec7]">
            {commissions.page_subtitle}
          </p>
        </div>

        {/* Services Grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:mt-14">
          {commissions.services.map((service, idx) => {
            const ServiceIcon = serviceIcons[idx % serviceIcons.length];

            return (
            <div key={service.id} className="public-quiet-card flex flex-col p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner shrink-0">
                <ServiceIcon size={24} className="text-[#d7b663]" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{service.title}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-[#a0aab5] flex-grow">
                {service.description}
              </p>
            </div>
          )})}
        </div>

        {/* Guardrail Note */}
        <div className="public-quiet-card mt-4 p-5">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[#d7b663]">
            {commissions.quote_eyebrow}
          </p>
          <p className="mx-auto mt-2 max-w-3xl text-center text-sm leading-relaxed text-[#8a949f]">
            {commissions.quote_description}
          </p>
        </div>

        {/* The Form Section */}
        <div className="mt-16 lg:mt-24">
          <CommissionRequestForm content={commissions} />
        </div>

        {/* Extra Notes */}
        <div className="mt-16 space-y-6 text-center">
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-[#76808a]">
            {commissions.terms_primary}
          </p>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-[#76808a]">
            {commissions.terms_secondary}
          </p>
        </div>
      </div>
    </main>
  );
}
