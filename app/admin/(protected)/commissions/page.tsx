export const dynamic = "force-dynamic";

import {listCommissionRequests} from "@/lib/repositories/commissions";
import {CommissionsAdminPage} from "@/components/commissions-admin-page";
import {Palette} from "lucide-react";

export default async function AdminCommissionsRoute() {
  const initialRequests = await listCommissionRequests();

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="panel px-6 py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="pill">
                <Palette size={12} />
                Commissions
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
                Commission Requests
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Review and manage requests for hooks, verses, custom songs, and features.
                Approve requests, set quotes, track PayPal payments, and deliver the final work.
              </p>
            </div>
          </div>
        </section>

        <CommissionsAdminPage initialRequests={initialRequests} />
      </div>
    </main>
  );
}
