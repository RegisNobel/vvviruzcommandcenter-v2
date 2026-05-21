import Link from "next/link";
import { ArrowLeft, Camera, Sparkles, Layers, Crop, Palette, ArrowRight } from "lucide-react";

export default function AdminPhotoLabPage() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1000px] space-y-8">
        
        {/* Navigation Breadcrumb / Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[#8a9098]">
            <Link className="transition hover:text-[#f0eadf]" href="/admin/releases">Releases</Link>
            <span>/</span>
            <Link className="transition hover:text-[#f0eadf]" href="/admin/ad-lab">Ad Lab</Link>
            <span>/</span>
            <span className="text-[#d7b45e]">Photo Lab</span>
          </div>
          
          <Link 
            href="/admin/releases"
            className="inline-flex items-center gap-2 rounded-full border border-[#30343b] bg-[#121418] px-4 py-2 text-xs font-bold text-[#ede7db] transition hover:bg-[#1c1f24] hover:border-[#d7b45e]/50"
          >
            <ArrowLeft size={14} />
            Back to Active Workflows
          </Link>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-[32px] border border-[#30343b] bg-gradient-to-br from-[#16191d] via-[#121418] to-[#1a1c22] p-8 sm:p-12">
          {/* Subtle Glow Overlay */}
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#d7b45e]/5 blur-[80px]" />
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#4a3c1d] bg-[#1a1710] px-3.5 py-1 text-xs font-semibold text-[#d7b45e]">
              <Sparkles size={12} className="animate-pulse" />
              Feature Preview
            </div>
            
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[#f0eadf] sm:text-5xl">
              Photo Lab
            </h1>
            <p className="mt-4 text-base leading-7 text-[#8a9098]">
              An integrated canvas tool tailored for the single-owner operator. 
              Generate high-resolution release covers, resize visual assets for DSP compliance, 
              and auto-format promotional banners in one click.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#1e1a12] border border-[#d7b45e]/20 px-4 py-2 text-sm font-semibold text-[#d7b45e]">
                Coming Soon
              </span>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid (Coming Soon - Non-interactive details) */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-[24px] border border-[#272b31] bg-[#121418] p-6 sm:p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#16191d] border border-[#272b31] text-[#d7b45e]">
              <Layers size={20} />
            </div>
            <h3 className="text-xl font-bold text-[#f0eadf]">DSP Cover Generator</h3>
            <p className="text-sm leading-6 text-[#8a9098]">
              Automate compliant 3000x3000px cover art layouts using your custom uploaded backgrounds, with perfect typographic ratios.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#272b31] bg-[#121418] p-6 sm:p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#16191d] border border-[#272b31] text-[#d7b45e]">
              <Crop size={20} />
            </div>
            <h3 className="text-xl font-bold text-[#f0eadf]">Aspect Ratio Canvas</h3>
            <p className="text-sm leading-6 text-[#8a9098]">
              Instantly extract cover art into 9:16 (vertical story), 16:9 (widescreen), and 4:5 (feed) aspect ratios for multi-channel promo.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#272b31] bg-[#121418] p-6 sm:p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#16191d] border border-[#272b31] text-[#d7b45e]">
              <Palette size={20} />
            </div>
            <h3 className="text-xl font-bold text-[#f0eadf]">Brand Palette Swatches</h3>
            <p className="text-sm leading-6 text-[#8a9098]">
              Extract key hexadecimal color profiles from uploaded artwork to maintain styling consistency across landing pages and widgets.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#272b31] bg-[#121418] p-6 sm:p-8 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#16191d] border border-[#272b31] text-[#d7b45e]">
              <Camera size={20} />
            </div>
            <h3 className="text-xl font-bold text-[#f0eadf]">Smart Asset Overlays</h3>
            <p className="text-sm leading-6 text-[#8a9098]">
              Apply streaming service badges, parental advisory logos, and release date stamps dynamically without using external image editors.
            </p>
          </div>
        </div>

        {/* Quick Links Back to Active Workflows */}
        <section className="rounded-[24px] border border-[#272b31] bg-[#16191d] p-6 sm:p-8">
          <h3 className="text-lg font-bold text-[#f0eadf] mb-4">Active Creative Workflows</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link 
              href="/admin/releases"
              className="flex items-center justify-between rounded-xl border border-[#272b31] bg-[#121418] p-4 text-sm font-semibold text-[#ede7db] transition hover:border-[#d7b45e]/50 hover:bg-[#1a1c22]"
            >
              <span>Manage Releases</span>
              <ArrowRight size={16} className="text-[#8a9098]" />
            </Link>

            <Link 
              href="/admin/copy-lab"
              className="flex items-center justify-between rounded-xl border border-[#272b31] bg-[#121418] p-4 text-sm font-semibold text-[#ede7db] transition hover:border-[#d7b45e]/50 hover:bg-[#1a1c22]"
            >
              <span>Write Hook Copy</span>
              <ArrowRight size={16} className="text-[#8a9098]" />
            </Link>

            <Link 
              href="/admin/ad-lab"
              className="flex items-center justify-between rounded-xl border border-[#272b31] bg-[#121418] p-4 text-sm font-semibold text-[#ede7db] transition hover:border-[#d7b45e]/50 hover:bg-[#1a1c22]"
            >
              <span>Run Ad Analytics</span>
              <ArrowRight size={16} className="text-[#8a9098]" />
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
