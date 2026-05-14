export const dynamic = "force-dynamic";

import {notFound} from "next/navigation";
import Link from "next/link";
import {ArrowLeft, Palette} from "lucide-react";
import {getCommissionRequest} from "@/lib/repositories/commissions";
import {CommissionDetailEditor} from "@/components/commission-detail-editor";

export default async function AdminCommissionDetailRoute({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = await params;
  const request = await getCommissionRequest(id);

  if (!request) {
    notFound();
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <section className="panel px-6 py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="pill">
                  <Palette size={12} />
                  Commissions
                </div>
                <span className="text-sm font-medium text-slate-400">/</span>
                <span className="text-sm font-medium text-slate-500">{request.name}</span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Request Details
              </h1>
            </div>
            <Link className="action-button-secondary" href="/admin/commissions">
              <ArrowLeft size={16} />
              Back to List
            </Link>
          </div>
        </section>

        <CommissionDetailEditor initialRequest={request} />
      </div>
    </main>
  );
}
