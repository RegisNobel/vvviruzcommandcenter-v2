export const dynamic = "force-dynamic";

import Image from "next/image";
import {redirect} from "next/navigation";
import type {Metadata} from "next";
import {Check, LockKeyhole, Music2} from "lucide-react";

import {readSiteSettings} from "@/lib/repositories/site-settings";
import {VaultPageAnalytics} from "@/components/vault-page-analytics";
import {FanTrackedLink, VaultItemImpressions} from "@/components/public-fan-content-analytics";
import {
  DEFAULT_VAULT_OFFER_DETAILS,
  listPublicVaultItems
} from "@/lib/repositories/fan-content";
import {ExclusiveSignupForm} from "@/components/exclusive-signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSiteSettings();

  return {
    title: settings.site_content.vault.title || "The Vault EP",
    description: settings.site_content.vault.subtitle || "Premium digital-only bundle",
    alternates: {canonical: "/vault"},
    openGraph: {
      type: "website",
      title: settings.site_content.vault.title || "The Vault EP",
      description: settings.site_content.vault.subtitle || "Premium digital-only bundle",
      url: "/vault"
    }
  };
}

export default async function PublicVaultPage() {
  const settings = await readSiteSettings();
  const vault = settings.site_content.vault;

  if (!vault.is_enabled) {
    redirect("/exclusives");
  }

  const benefits = vault.benefits.filter(
    (b) => b.title.trim() || b.description.trim()
  );
  const items = await listPublicVaultItems();
  const featuredBundle =
    items.find((item) => item.item_type.toLowerCase() === "bundle") ?? null;
  const additionalItems = featuredBundle
    ? items.filter((item) => item.id !== featuredBundle.id)
    : items;
  const artworkUrl = featuredBundle?.cover_art_url || "";
  const checkoutUrl = featuredBundle?.checkout_url || "";
  const isAvailable = Boolean(checkoutUrl);
  const offerTitle = featuredBundle?.title || vault.title;
  const offerDescription = featuredBundle?.description || vault.body;
  const offerDetails = featuredBundle?.offer_details ?? DEFAULT_VAULT_OFFER_DETAILS;

  return (
    <main className="public-conversion-shell overflow-hidden pb-20">
      <VaultPageAnalytics />
      <VaultItemImpressions ids={items.map((item) => item.id)} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(201,163,71,0.2),transparent_28%),radial-gradient(circle_at_82%_28%,rgba(95,109,130,0.12),transparent_25%),linear-gradient(180deg,rgba(5,6,9,0.97),rgba(7,9,13,1))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.024)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[length:52px_52px] opacity-25" />

      <div className="relative mx-auto max-w-[1180px]">
        <section className="public-panel relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(201,163,71,0.72),transparent)]" />
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] lg:gap-12">
            <div className="relative mx-auto aspect-square w-full max-w-[430px] overflow-hidden rounded-xl border border-white/10 bg-[#090b0f]">
              {artworkUrl ? (
                <Image
                  alt={`${offerTitle} artwork`}
                  className="object-cover"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 430px"
                  src={artworkUrl}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(201,163,71,0.17),transparent_46%),linear-gradient(145deg,#151921,#080a0e)] px-8 text-center">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:28px_28px] opacity-40" />
                  <LockKeyhole className="relative text-[#d7b663]" size={34} />
                  <p className="relative mt-6 font-mono text-xs uppercase tracking-[0.34em] text-[#8f98a5]">
                    Vault transmission
                  </p>
                  <p className="relative mt-3 text-5xl font-semibold tracking-[-0.06em] text-[#f7f1e6] sm:text-6xl">
                    V//DROP
                  </p>
                  <p className="relative mt-4 text-xs uppercase tracking-[0.24em] text-[#d7b663]">
                    Artwork incoming
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="public-eyebrow inline-flex rounded-full border border-[#c9a347]/28 bg-[#c9a347]/10 px-4 py-1 text-[#d7b663]">
                {vault.badge_text}
              </div>

              <h1 className="mt-7 max-w-3xl text-4xl font-bold tracking-tight text-[#f7f1e6] sm:text-6xl">
                {offerTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-[#e8dcc3] sm:text-xl">
                {vault.subtitle}
              </p>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[#a7b0ba]">
                {offerDescription}
              </p>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 border-y border-white/10 py-4 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[#a7b0ba]">
                {offerDetails.facts.map((fact, index) => (
                  <span className={index === 0 ? "text-[#f7f1e6]" : undefined} key={fact}>
                    {fact}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <div className="mb-5">
              <p className="public-eyebrow">{offerDetails?.detailsEyebrow}</p>
              <h2 className="public-heading mt-3 text-3xl font-semibold">
                {offerDetails?.detailsHeading}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#a7b0ba]">
                {offerDetails?.detailsDescription}
              </p>
            </div>

            <div className="border-y border-white/10">
              {offerDetails.tracks.map((track, index) => (
                <div
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-1 py-5 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
                  key={`${track.title}-${index}`}
                >
                  <span className="font-mono text-xs text-[#59616d]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#e8dcc3]">
                      {track.title}
                    </p>
                    <p className="mt-1 text-xs text-[#8f98a5]">{track.subtitle}</p>
                  </div>
                  <LockKeyhole className="text-[#59616d]" size={16} />
                </div>
              ))}
            </div>
          </div>

          <aside className="public-panel overflow-hidden p-5 sm:p-6 lg:sticky lg:top-28">
            <p className="public-eyebrow">
              {isAvailable ? offerDetails?.availableLabel : offerDetails?.comingSoonLabel}
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-[#f7f1e6]">
              {offerDetails?.purchaseHeading}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#a7b0ba]">
              {offerDetails?.purchaseDescription}
            </p>

            <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-[#8f98a5]">
                {offerDetails?.minimumLabel}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-4xl font-semibold tracking-tight text-[#f7f1e6]">
                  {offerDetails.priceDisplay}
                </p>
                <span className="pb-1 font-mono text-xs uppercase text-[#59616d]">
                  {offerDetails?.currencyLabel}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#8f98a5]">
                {offerDetails?.checkoutHelper}
              </p>
            </div>

            {benefits.length > 0 ? (
              <div className="mt-6 space-y-4">
                {benefits.slice(0, 3).map((benefit, index) => (
                  <div className="flex gap-3" key={benefit.id || index}>
                    <Check className="mt-0.5 shrink-0 text-[#31d98b]" size={16} />
                    <div>
                      <p className="text-sm font-semibold text-[#e8dcc3]">{benefit.title}</p>
                      {benefit.description ? (
                        <p className="mt-1 text-xs leading-5 text-[#8f98a5]">
                          {benefit.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-7">
              {isAvailable && featuredBundle ? (
                <FanTrackedLink
                  className="public-action-primary flex w-full justify-center"
                  eventKey={featuredBundle.id}
                  eventType="vault_checkout_click"
                  href={checkoutUrl}
                  page="vault"
                  target="_blank"
                >
                  {offerDetails?.purchaseCtaLabel}
                </FanTrackedLink>
              ) : (
                <ExclusiveSignupForm
                  consentLabel={vault.waitlist_consent_label}
                  ctaLabel={vault.cta_label || "Get the Drop Notice"}
                  emailLabel="Email"
                  nameLabel="Name"
                  requireConsent
                  showNameField={false}
                  signupContext="vault_waitlist"
                  successHeading={vault.waitlist_success_heading}
                  unlockExperience="signup_notify"
                />
              )}
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-[#59616d]">
              {isAvailable
                ? offerDetails?.fulfillmentNote
                : vault.waitlist_note}
            </p>

            {isAvailable ? (
              <div className="mt-7 border-t border-white/10 pt-6">
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[#d7b663] marker:hidden">
                    {vault.future_updates_heading}
                    <span
                      aria-hidden="true"
                      className="ml-2 inline-block transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-[#a7b0ba]">
                    {vault.future_updates_description}
                  </p>
                  <div className="mt-4">
                    <ExclusiveSignupForm
                      consentLabel={vault.future_updates_consent_label}
                      ctaLabel={vault.future_updates_cta_label}
                      emailLabel="Email"
                      nameLabel="Name"
                      requireConsent
                      showNameField={false}
                      signupContext="vault_waitlist"
                      successHeading={vault.waitlist_success_heading}
                      unlockExperience="signup_notify"
                    />
                  </div>
                </details>
              </div>
            ) : null}
          </aside>
        </section>

        {additionalItems.length > 0 ? (
          <section className="relative mt-16">
            <div className="mb-6">
              <p className="public-eyebrow">{vault.more_eyebrow}</p>
              <h2 className="public-heading mt-3 text-3xl font-semibold">
                {vault.more_heading}
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {additionalItems.map((item) => (
                <article className="public-panel overflow-hidden p-5" key={item.id}>
                  {item.cover_art_url ? (
                    <div className="relative aspect-square overflow-hidden rounded-lg">
                      <Image
                        alt={`${item.title} artwork`}
                        className="object-cover"
                        fill
                        sizes="(max-width:768px) 100vw, 33vw"
                        src={item.cover_art_url}
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-lg border border-white/10 bg-black/20">
                      <Music2 className="text-[#59616d]" size={30} />
                    </div>
                  )}
                  <p className="public-eyebrow mt-5">{item.item_type}</p>
                  <h3 className="public-heading mt-2 text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#a7b0ba]">{item.description}</p>
                  {item.price_label ? (
                    <p className="mt-4 font-semibold text-[#e3c16e]">{item.price_label}</p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-3">
                    {item.preview_url ? (
                      <FanTrackedLink
                        className="public-action-secondary"
                        eventKey={item.id}
                        eventType="vault_preview_click"
                        href={item.preview_url}
                        page="vault"
                        target="_blank"
                      >
                        {vault.preview_cta_label}
                      </FanTrackedLink>
                    ) : null}
                    {item.checkout_url ? (
                      <FanTrackedLink
                        className="public-action-primary"
                        eventKey={item.id}
                        eventType="vault_checkout_click"
                        href={item.checkout_url}
                        page="vault"
                        target="_blank"
                      >
                        {vault.item_purchase_cta_label}
                      </FanTrackedLink>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
