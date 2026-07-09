import Link from "next/link";
import {ChevronLeft} from "lucide-react";
import {AppearsOnForm} from "@/components/appears-on-form";

export default function AdminAppearsOnCreatePage() {
  return (
    <main className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"
          href="/admin/site"
        >
          <ChevronLeft size={16} />
          Back to Public Site
        </Link>
      </div>

      <section className="command-surface mb-8 px-5 py-6 sm:px-6 sm:py-7">
        <div className="pill">Appears On</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Add Feature</h1>
        <p className="mt-2 text-sm text-muted">Create a new Appears On entry.</p>
      </section>

      <AppearsOnForm />
    </main>
  );
}
