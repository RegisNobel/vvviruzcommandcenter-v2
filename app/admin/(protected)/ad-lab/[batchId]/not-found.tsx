import Link from "next/link";

export default function AdBatchNotFound() {
  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <section className="panel mx-auto max-w-3xl px-4 py-8 text-center sm:px-8">
        <div className="pill mx-auto w-fit">Ad Lab</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          Import batch not found
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
          This batch may have been deleted during cleanup, or the link no longer points to an
          existing Ad Lab import.
        </p>
        <Link className="action-button-primary mt-6" href="/admin/ad-lab">
          Back to Ad Lab
        </Link>
      </section>
    </main>
  );
}
