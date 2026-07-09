import {notFound} from "next/navigation";
import Link from "next/link";
import {ChevronLeft} from "lucide-react";
import {AppearsOnForm} from "@/components/appears-on-form";
import {readAppearsOn} from "@/lib/repositories/appears-on";

export const dynamic = "force-dynamic";

export default async function AdminAppearsOnEditPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const record = await readAppearsOn(id);

  if (!record) {
    notFound();
  }

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
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Edit Feature</h1>
        <p className="mt-2 text-sm text-muted">Update details for this collaboration.</p>
      </section>

      <AppearsOnForm initialRecord={record} />
    </main>
  );
}
