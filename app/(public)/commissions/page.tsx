export const dynamic = "force-dynamic";

import {type Metadata} from "next";
import {CommissionRequestForm} from "@/components/commission-request-form";
import {Sparkles, Mic, Music, Users} from "lucide-react";
import {readSiteSettings} from "@/lib/repositories/site-settings";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await readSiteSettings();
  const isOpen = siteSettings.site_content.commissions.is_enabled;
  const description = isOpen
    ? "Request custom hooks, verses, full custom songs, or collab features from vvviruz."
    : "Commission requests from vvviruz are currently closed. Check the page for availability updates.";

  return {
    title: "Commissions",
    description,
    alternates: {canonical: "/commissions"},
    openGraph: {
      type: "website",
      title: "Commissions | vvviruz",
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
          <p className="public-eyebrow text-[#d7b663]">Commissions</p>
          <h1 className="mt-4 text-3xl font-semibold text-[#f7f1e6] sm:text-4xl">
            Requests are currently closed
          </h1>
          <p className="mt-4 text-lg text-[#b6bec7] max-w-md mx-auto">
            {commissions.closed_message}
          </p>
          <Link 
            href="/music"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-[#c9a347] px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-[#d7b663]"
          >
            Explore the catalog
          </Link>
        </div>
      </main>
    );
  }

  const services = [
    {
      icon: <Mic size={24} className="text-[#d7b663]" />,
      title: commissions.card_title,
      description: commissions.card_description
    },
    {
      icon: <Music size={24} className="text-[#d7b663]" />,
      title: "Full Custom Song",
      description: "A custom song built around your topic, character, story, brand, or concept. Final quote depends on length, deadline, and usage."
    },
    {
      icon: <Users size={24} className="text-[#d7b663]" />,
      title: "Collab / Feature Inquiry",
      description: "For artists looking to collaborate, co-release, or get a vvviruz feature. Splits, credits, and release terms must be agreed before delivery."
    }
  ];

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
          {services.map((service, idx) => (
            <div key={idx} className="public-quiet-card flex flex-col p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner shrink-0">
                {service.icon}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{service.title}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-[#a0aab5] flex-grow">
                {service.description}
              </p>
            </div>
          ))}
        </div>

        {/* Guardrail Note */}
        <div className="public-quiet-card mt-4 p-5">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[#d7b663]">
            Custom quote
          </p>
          <p className="mx-auto mt-2 max-w-3xl text-center text-sm leading-relaxed text-[#8a949f]">
            Pricing depends on the request type, scope, deadline, usage, revisions, and required deliverables. Submit your brief and you will receive a quote before work begins.
          </p>
        </div>

        {/* The Form Section */}
        <div className="mt-16 lg:mt-24">
          <CommissionRequestForm />
        </div>

        {/* Extra Notes */}
        <div className="mt-16 space-y-6 text-center">
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-[#76808a]">
            Custom dedications or supporter mentions can be requested, but placement depends on creative fit and is not guaranteed on any specific release unless agreed directly.
          </p>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-[#76808a]">
            Submitting a request does not guarantee acceptance. Custom work is reviewed before approval. Pricing, rights, credits, splits, turnaround time, and delivery details must be agreed before work begins. Payment is handled externally through PayPal for now.
          </p>
        </div>
      </div>
    </main>
  );
}
