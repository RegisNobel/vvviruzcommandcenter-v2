import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Clapperboard,
  Captions,
  Globe2,
  MailPlus,
  Music4
} from "lucide-react";

export default function AdminHomePage() {
  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel overflow-hidden px-4 py-7 sm:px-8 sm:py-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="pill">Creative operations hub</div>
              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
                vvviruz&apos; command center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Keep Video Lab, Copy Lab, Analytics, and release planning in one
                local-first workspace. Build video clips, pair hooks with captions,
                track rollout progress, and stay inside a clean single-user setup.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="pill">Private admin area</span>
                <span className="pill">SQLite + local media storage</span>
                <span className="pill">TOTP protected</span>
              </div>
            </div>

            <div className="rounded-[28px] bg-hero-mesh p-4 sm:p-6 shadow-soft">
              <div className="rounded-[24px] border border-white/60 bg-white/80 p-4 sm:p-5 backdrop-blur">
                <p className="field-label">Inside this workspace</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-[22px] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">Video Lab</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Upload audio, transcribe, style, preview, and export video clips.
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">Releases</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Track songs, visuals, promo tasks, and release readiness from one page.
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">Copy Lab</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Pair hooks and captions, then keep them linked to a release or standalone.
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">Audience</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Capture subscribers and run lean campaign sends from one page.
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">Analytics</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Reserved for performance tracking and future reporting views.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-6">
          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/audience"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <MailPlus size={12} />
                  Audience
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Capture and email subscribers
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Manage the subscriber list and lean campaign sends from one
                  protected page. Exclusive offer settings live under Public Site.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>

          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/site"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <Globe2 size={12} />
                  Public Site
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Manage the public website
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Update bios, hero copy, social links, and link-hub items from one
                  dedicated admin page.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>

          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/analytics"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <BarChart3 size={12} />
                  Analytics
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Open the analytics workspace
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Keep a dedicated place ready for performance tracking and reporting.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>

          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/video-lab"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <Music4 size={12} />
                  Video Lab
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Open the video studio
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Build video clips from trimmed audio with local transcription,
                  instant preview, and export.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>

          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/copy-lab"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <Captions size={12} />
                  Copy Lab
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Build hook and caption pairs
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Create copy angles for releases or keep neutral standalone copy ready
                  for later.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>


          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/releases/roadmap"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <CalendarClock size={12} />
                  Roadmap
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Open the 2026 roadmap
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Scan the 2026 first-Wednesday release plan, stage progress, blockers,
                  clips, copy, and tasks without digging through the full catalog.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>
          <Link
            className="panel group px-6 py-7 transition hover:-translate-y-0.5 hover:border-coral/40 hover:bg-white/80"
            href="/admin/releases"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <Clapperboard size={12} />
                  Releases
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-ink">
                  Track release progress
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  Manage concepts, song status, visuals, promo checklists, and tasks
                  for every release.
                </p>
              </div>
              <ArrowRight className="mt-1 transition group-hover:translate-x-1" size={20} />
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
