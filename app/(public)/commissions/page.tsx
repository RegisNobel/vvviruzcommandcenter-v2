export const dynamic = "force-dynamic";

import {type Metadata} from "next";

import {CommissionRequestForm} from "@/components/commission-request-form";
import {Sparkles, Mic, Music, Users} from "lucide-react";

export const metadata: Metadata = {
  title: "Commissions & Features | vvviruz",
  description: "Request custom hooks, verses, full custom songs, or collab features from vvviruz."
};

const SERVICES = [
  {
    icon: <Sparkles size={24} className="text-[#d7b663]" />,
    title: "Hook Commission",
    price: "$50",
    description: "Need a catchy hook for your track? Send the beat, topic, and vibe. I’ll write and record a custom hook."
  },
  {
    icon: <Mic size={24} className="text-[#d7b663]" />,
    title: "Verse Commission",
    price: "$50",
    description: "Need a vvviruz verse on your song? Send the beat and direction. I’ll write and record a verse tailored to the track."
  },
  {
    icon: <Music size={24} className="text-[#d7b663]" />,
    title: "Full Custom Song",
    price: "Starting at $100",
    description: "A custom song built around your topic, character, story, brand, or concept. Final quote depends on length, deadline, and usage."
  },
  {
    icon: <Users size={24} className="text-[#d7b663]" />,
    title: "Collab / Feature Inquiry",
    price: "Starting at $100 + splits",
    description: "For artists looking to collaborate, co-release, or get a vvviruz feature. Splits, credits, and release terms must be agreed before delivery."
  }
];

export default function CommissionsPage() {
  return (
    <main className="min-h-[100dvh] bg-[#050609]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,163,71,0.08),transparent_40%),linear-gradient(180deg,rgba(5,6,9,0.96),rgba(7,9,13,1))]" />
      
      <div className="relative mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        {/* Hero Section */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a347]/20 bg-[#c9a347]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b663]">
            <Sparkles size={14} />
            Work with vvviruz
          </div>
          <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-[#f7f1e6] sm:text-5xl md:text-6xl lg:text-[4rem] lg:leading-[1.05]">
            Custom hooks, verses, and songs from vvviruz.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#b6bec7]">
            Need bilingual bars, anime-level energy, or a custom track built around your idea? Submit a request and I’ll review the fit.
          </p>
        </div>

        {/* Services Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:mt-24">
          {SERVICES.map((service, idx) => (
            <div key={idx} className="rounded-[28px] border border-white/10 bg-[#0c1015]/82 p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
                {service.icon}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{service.title}</h3>
              <div className="mt-2 inline-block rounded-md bg-[#1a1710] px-2.5 py-1 text-sm font-semibold text-[#d7b45e] border border-[#5b4920]/40">
                {service.price}
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-[#a0aab5]">
                {service.description}
              </p>
            </div>
          ))}
        </div>

        {/* Guardrail Note */}
        <div className="mt-8 rounded-2xl bg-white/[0.02] p-5 border border-white/5">
          <p className="text-sm leading-relaxed text-[#8a949f] text-center">
            Prices are starter rates for standard requests. Every commission is reviewed before approval. Rush deadlines, complex concepts, commercial usage, extra revisions, or expanded delivery needs may require a custom quote.
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
