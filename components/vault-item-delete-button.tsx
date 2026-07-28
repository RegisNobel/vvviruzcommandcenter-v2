"use client";

import {deleteFanContentAction} from "@/app/admin/(protected)/fan-content/actions";

export function VaultItemDeleteButton({id}: {id: string}) {
  return (
    <form
      action={deleteFanContentAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Permanently delete this Vault item? Archive completed bundles instead. Deletion removes the item record from future backups."
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input name="id" type="hidden" value={id}/>
      <input name="kind" type="hidden" value="vault"/>
      <button className="text-xs font-semibold text-red-300" type="submit">
        Delete permanently
      </button>
    </form>
  );
}
