"use client";

import {useEffect} from "react";
import Link from "next/link";

import {ErrorState} from "@/components/ui-state";

export default function AdminErrorBoundary({
  error,
  reset
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page render failed.", {
      digest: error.digest || "unavailable",
      name: error.name
    });
  }, [error]);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <ErrorState
          action={{label: "Try again", onClick: reset}}
          message="This admin page could not finish loading. Your saved data has not been changed. Try again, or return to Releases if the problem continues."
          title="The Command Center hit a loading problem"
        />
        <Link className="action-button-secondary mt-4" href="/admin/releases">
          Return to Releases
        </Link>
      </div>
    </main>
  );
}
