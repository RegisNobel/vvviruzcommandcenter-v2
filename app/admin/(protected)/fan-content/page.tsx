import Link from "next/link";
import {BookOpen, Box, Radio} from "lucide-react";

import {ReleasePicker} from "@/components/release-picker";
import {listAdminFanContent} from "@/lib/repositories/fan-content";
import {getLatestIntelTypeLabel} from "@/lib/latest-intel";
import {
  createFanUpdateAction,
  createVaultItemAction,
  deleteFanContentAction,
  setFanUpdatePublicationAction,
  updateFanUpdateAction
} from "./actions";

export const dynamic = "force-dynamic";

const input = "field-input mt-2";
const panel = "command-surface space-y-5 p-5 sm:p-6";

function ReleaseSelect({
  defaultValue = "",
  releases
}: {
  defaultValue?: string;
  releases: Array<{id: string; title: string}>;
}) {
  return (
    <ReleasePicker
      ariaLabel="Select related release"
      className="mt-2"
      defaultValue={defaultValue}
      emptyOption={{label: "Standalone / none", value: ""}}
      name="releaseId"
      releases={releases}
    />
  );
}

function IntelTypeSelect({defaultValue = "release"}: {defaultValue?: string}) {
  return (
    <select className={input} defaultValue={defaultValue} name="type">
      <option value="release">Release update</option>
      <option value="annotation">New annotation</option>
      <option value="project">Project update</option>
      <option value="vault">Vault drop</option>
    </select>
  );
}

function DeleteButton({id, kind}: {id: string; kind: string}) {
  return (
    <form action={deleteFanContentAction}>
      <input name="id" type="hidden" value={id}/>
      <input name="kind" type="hidden" value={kind}/>
      <button className="text-xs font-semibold text-red-300" type="submit">Delete</button>
    </form>
  );
}

function PublicationButton({id, isPublished}: {id: string; isPublished: boolean}) {
  return (
    <form action={setFanUpdatePublicationAction}>
      <input name="id" type="hidden" value={id}/>
      <input name="publicationAction" type="hidden" value={isPublished ? "unpublish" : "publish"}/>
      <button className={isPublished ? "action-button-secondary px-3 py-1.5 text-xs" : "btn-primary px-3 py-1.5 text-xs"} type="submit">
        {isPublished ? "Unpublish" : "Publish"}
      </button>
    </form>
  );
}

function IntelAge({publishedAt}: {publishedAt: Date | null}) {
  if (!publishedAt) return null;
  const ageInDays = Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000);
  return (
    <span className={ageInDays >= 90 ? "text-status-warning" : "text-muted"}>
      Published {ageInDays === 0 ? "today" : `${ageInDays} day${ageInDays === 1 ? "" : "s"} ago`}
      {ageInDays >= 90 ? " / consider unpublishing" : ""}
    </span>
  );
}

type FanContentData = Awaited<ReturnType<typeof listAdminFanContent>>;
type FanUpdateRow = FanContentData["fanUpdates"][number];

function IntelEntry({
  item,
  order,
  releases
}: {
  item: FanUpdateRow;
  order?: number;
  releases: FanContentData["releases"];
}) {
  return (
    <article className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
            <span className={item.isPublished ? "status-badge-ready" : "status-badge-neutral"}>
              {item.isPublished ? `Public${order ? ` / position ${order}` : ""}` : "Draft"}
            </span>
            <span className="text-status-info">{getLatestIntelTypeLabel(item.type)}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
          {item.summary ? <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {item.release ? <span className="text-muted">Release: {item.release.title}</span> : null}
            <span className="text-muted">{item.href ? "Linked update" : "Update only"}</span>
            <IntelAge publishedAt={item.publishedAt}/>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <PublicationButton id={item.id} isPublished={item.isPublished}/>
          <DeleteButton id={item.id} kind="update"/>
        </div>
      </div>

      <details className="mt-4 border-t border-edge pt-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">
          Edit update
        </summary>
        <form action={updateFanUpdateAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input name="id" type="hidden" value={item.id}/>
          <div>Release (optional)<ReleaseSelect defaultValue={item.releaseId || ""} releases={releases}/></div>
          <label>Type<IntelTypeSelect defaultValue={item.type}/></label>
          <label>Title<input className={input} defaultValue={item.title} maxLength={140} name="title" required/></label>
          <label>Public link (optional)<input className={input} defaultValue={item.href} name="href"/></label>
          <label className="sm:col-span-2">Summary<textarea className={input} defaultValue={item.summary} maxLength={300} name="summary" rows={3}/></label>
          <p className="text-xs leading-5 text-muted sm:col-span-2">Editing a published entry does not change its public ordering date.</p>
          <button className="action-button-secondary sm:col-span-2" type="submit">Save changes</button>
        </form>
      </details>
    </article>
  );
}

export default async function FanContentPage({searchParams}: {searchParams: Promise<{message?: string}>}) {
  const [{annotations, fanUpdates, vaultItems, releases}, query] = await Promise.all([
    listAdminFanContent(),
    searchParams
  ]);
  const publishedUpdates = fanUpdates.filter((item) => item.isPublished);
  const draftUpdates = fanUpdates.filter((item) => !item.isPublished);

  return (
    <main className="page-shell space-y-6">
      <header className="command-surface px-5 py-6 sm:px-8">
        <p className="section-kicker">Public knowledge + catalog</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Fan Content</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">Review release explanations, fan-facing updates, and direct-to-fan Vault items. Breaking Barz editing lives with each release so lyrics and anchors share one source of truth.</p>
        {query.message ? <p className="mt-4 text-sm text-emerald-300">{query.message}</p> : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={panel}>
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-300"/>
            <div><p className="section-kicker">Breaking Barz readout</p><h2 className="text-xl font-semibold text-ink">Release annotations</h2></div>
          </div>
          <p className="text-sm leading-6 text-muted">Create, re-anchor, publish, and archive annotations from the matching Release Detail page.</p>
          <div className="space-y-2 border-t border-edge pt-4">
            {annotations.map((item) => <Link className="flex items-center justify-between gap-3 rounded-lg border border-edge px-3 py-3 text-sm transition hover:border-brand-primary/50" href={`/admin/releases/${item.releaseId}#release-annotations`} key={item.id}><span>{item.release.title}: {item.title}</span><span className="text-xs text-muted">{item.status}{item.isPublic ? " / public" : ""}</span></Link>)}
            {!annotations.length ? <p className="text-sm text-muted">No release annotations yet.</p> : null}
          </div>
        </section>

        <section className={panel}>
          <div className="flex items-center gap-3">
            <Radio className="text-blue-300"/>
            <div><p className="section-kicker">Return loop</p><h2 className="text-xl font-semibold text-ink">Latest Intel</h2></div>
          </div>
          <p className="text-sm leading-6 text-muted">The five newest published updates rotate across editorial public pages. Unpublishing hides an update without changing its original position.</p>
          <form action={createFanUpdateAction} className="grid gap-4 border-t border-edge pt-5 sm:grid-cols-2">
            <div>Release (optional)<ReleaseSelect releases={releases}/></div>
            <label>Type<IntelTypeSelect/></label>
            <label>Title<input className={input} maxLength={140} name="title" required/></label>
            <label>Public link (optional)<input className={input} name="href" placeholder="/music/song or https://..."/><span className="mt-1 block text-xs leading-5 text-muted">Leave blank for an upcoming-track update that should not open a public page yet.</span></label>
            <label className="sm:col-span-2">Summary<textarea className={input} maxLength={300} name="summary" rows={3}/></label>
            <label className="flex items-center gap-2 sm:col-span-2"><input name="isPublished" type="checkbox"/> Publish now</label>
            <button className="btn-primary sm:col-span-2" type="submit">Save update</button>
          </form>

          <div className="space-y-4 border-t border-edge pt-5">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink">Published</h3><span className="text-xs text-muted">Newest first / {publishedUpdates.length} total</span></div>
            {publishedUpdates.map((item, index) => <IntelEntry item={item} key={item.id} order={index + 1} releases={releases}/>)}
            {!publishedUpdates.length ? <p className="text-sm text-muted">No public Intel updates. Publish a draft when it is ready.</p> : null}
          </div>

          <div className="space-y-4 border-t border-edge pt-5">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink">Drafts</h3><span className="text-xs text-muted">{draftUpdates.length} total</span></div>
            {draftUpdates.map((item) => <IntelEntry item={item} key={item.id} releases={releases}/>)}
            {!draftUpdates.length ? <p className="text-sm text-muted">No Intel drafts.</p> : null}
          </div>
        </section>

        <section className={panel}>
          <div className="flex items-center gap-3"><Box className="text-brand-primary"/><div><p className="section-kicker">Direct-to-fan catalog</p><h2 className="text-xl font-semibold text-ink">Vault items</h2></div></div>
          <form action={createVaultItemAction} className="grid gap-4 sm:grid-cols-2"><div>Release (optional)<ReleaseSelect releases={releases}/></div><label>Item type<select className={input} name="itemType"><option value="track">Track</option><option value="bundle">Bundle</option><option value="extras">Extras</option></select></label><label>Title<input className={input} name="title" required/></label><label>Slug<input className={input} name="slug" placeholder="auto from title"/></label><label className="sm:col-span-2">Description<textarea className={input} name="description" rows={3}/></label><label>Cover art URL<input className={input} name="coverArtUrl"/></label><label>Preview URL<input className={input} name="previewUrl"/></label><label>Price label<input className={input} name="priceLabel" placeholder="Pay what you want / $9.99 minimum"/></label><label>Gumroad checkout URL<input className={input} name="checkoutUrl" placeholder="https://...gumroad.com/l/..."/></label><label>Status<select className={input} name="status"><option value="draft">Draft</option><option value="public">Public</option><option value="archived">Archived</option></select></label><p className="text-xs leading-5 text-muted sm:col-span-2">Keep the bundle in Draft while songs are in progress. Publishing requires a checkout URL and makes the bundle the main purchasable Vault offer.</p><button className="btn-primary sm:col-span-2" type="submit">Save Vault item</button></form>
          <div className="space-y-2 border-t border-edge pt-4">{vaultItems.map((item) => <div className="flex items-center justify-between gap-3 text-sm" key={item.id}><span>{item.title} <span className="text-muted">({item.status})</span></span><DeleteButton id={item.id} kind="vault"/></div>)}</div>
        </section>
      </div>
    </main>
  );
}
