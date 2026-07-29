export const dynamic = "force-dynamic";

import type {Metadata} from "next";
import {Clock3, FileCheck2, ShieldCheck} from "lucide-react";

import {ArtistIntakeForm} from "@/components/artist-intake-form";
import {COUNTRY_OPTIONS} from "@/lib/countries";
import {readArtistIntakeByToken} from "@/lib/repositories/artist-intakes";

export const metadata: Metadata = {
  title: "Private artist intake",
  description: "Private source-material intake for a managed artist profile.",
  robots: {index: false, follow: false}
};

export default async function ArtistIntakePage({
  params
}: {
  params: Promise<{token: string}>;
}) {
  const {token} = await params;
  const intake = await readArtistIntakeByToken(token, {recordOpen: true});

  if (!intake) {
    return (
      <main className="public-conversion-shell min-h-[75vh]">
        <section className="mx-auto max-w-2xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center sm:px-10">
          <h1 className="text-3xl font-semibold text-white">
            This intake link is not valid.
          </h1>
          <p className="mt-4 text-base leading-7 text-white/60">
            Ask for a fresh private invitation from the profile manager.
          </p>
        </section>
      </main>
    );
  }

  if (intake.status !== "DRAFT") {
    const isExpired = intake.status === "EXPIRED";
    return (
      <main className="public-conversion-shell min-h-[75vh]">
        <section className="mx-auto max-w-2xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center sm:px-10">
          <FileCheck2 className="mx-auto text-[#d7b663]" size={42} />
          <h1 className="mt-6 text-3xl font-semibold text-white">
            {isExpired
              ? "This intake link has expired."
              : "This intake is closed for editing."}
          </h1>
          <p className="mt-4 text-base leading-7 text-white/60">
            {isExpired
              ? "Ask for a new invitation if you still need to complete the form."
              : "The submitted answers are now being handled in the command center. Ask the profile manager to reopen the intake if a correction is needed."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="public-conversion-shell min-h-screen">
      <div className="mx-auto max-w-5xl py-8 sm:py-12">
        <header className="border border-white/10 bg-[linear-gradient(135deg,rgba(215,182,99,0.08),transparent_55%),rgba(255,255,255,0.025)] px-6 py-9 sm:px-10 sm:py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d7b663]">
            Private collaborator intake
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
            Build the source material for {intake.artistName}.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/60">
            This form captures the raw information needed for your managed artist
            profile and one editorial Start Here release. Nothing submitted here
            publishes automatically.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 border border-white/10 bg-black/20 p-4">
              <ShieldCheck className="mt-0.5 shrink-0 text-[#d7b663]" size={18} />
              <p className="text-sm leading-6 text-white/60">
                Private invitation link
              </p>
            </div>
            <div className="flex items-start gap-3 border border-white/10 bg-black/20 p-4">
              <Clock3 className="mt-0.5 shrink-0 text-[#d7b663]" size={18} />
              <p className="text-sm leading-6 text-white/60">
                Save a draft and return later
              </p>
            </div>
            <div className="flex items-start gap-3 border border-white/10 bg-black/20 p-4">
              <FileCheck2 className="mt-0.5 shrink-0 text-[#d7b663]" size={18} />
              <p className="text-sm leading-6 text-white/60">
                Editorial review before preview
              </p>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <ArtistIntakeForm
            countryOptions={COUNTRY_OPTIONS}
            initialResponse={intake.response}
            token={token}
          />
        </div>
      </div>
    </main>
  );
}
