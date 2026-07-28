import {LoadingState} from "@/components/ui-state";

export default function AdminLoading() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <LoadingState label="Loading Command Center" />
      </div>
    </main>
  );
}
