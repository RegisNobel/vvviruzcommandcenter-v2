import Link from "next/link";

export default function AdminPhotoLabPage() {
  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="panel overflow-hidden px-4 py-6 sm:px-8 sm:py-7">
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted">
              <Link className="transition hover:text-ink" href="/admin/ad-lab">Ad Lab</Link>
              <span>/</span>
              <span className="text-[#d7b45e]">Photo Lab</span>
            </div>
            <div className="pill">Photo Lab</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Photo Lab
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              This workspace is reserved for future cover art creation and image
              tooling.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
