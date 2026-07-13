import Link from "next/link";

export default function PublicProjectNotFound() {
  return (
    <main className="public-page-wrap">
      <section className="public-panel px-5 py-12 text-center sm:px-8">
        <p className="public-eyebrow">Project unavailable</p>
        <h1 className="public-heading mt-4 text-4xl font-semibold">That project is not public.</h1>
        <p className="public-copy mx-auto mt-4 max-w-xl text-sm leading-7">
          It may still be taking shape. The complete public catalog is available now.
        </p>
        <Link className="public-action-primary mt-7" href="/music">Explore music</Link>
      </section>
    </main>
  );
}
