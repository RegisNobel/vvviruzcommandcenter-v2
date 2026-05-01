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
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8f959d] transition hover:text-[#ece6da]"
          href="/admin/site"
        >
          <ChevronLeft size={16} />
          Back to Public Site
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#ece6da]">Edit Feature</h1>
        <p className="mt-1 text-sm text-[#8f959d]">Update details for this collaboration.</p>
      </div>

      <AppearsOnForm initialRecord={record} />
    </main>
  );
}
