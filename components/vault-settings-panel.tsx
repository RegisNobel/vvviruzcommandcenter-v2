"use client";

import {Lock} from "lucide-react";
import type {SiteSettingsRecord} from "@/lib/types";

type VaultSettings = SiteSettingsRecord["site_content"]["vault"];

type VaultSettingsPanelProps = {
  vaultSettings: VaultSettings;
  onChange: (vaultSettings: VaultSettings) => void;
};

export function VaultSettingsPanel({vaultSettings, onChange}: VaultSettingsPanelProps) {
  function updateVault(patch: Partial<VaultSettings>) {
    onChange({
      ...vaultSettings,
      ...patch
    });
  }

  function updateBenefit(
    index: number,
    patch: Partial<VaultSettings["benefits"][number]>
  ) {
    updateVault({
      benefits: vaultSettings.benefits.map((benefit, i) =>
        i === index ? {...benefit, ...patch} : benefit
      )
    });
  }

  return (
    <section className="rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="field-label">Section 14</p>
          <h3 className="mt-3 flex items-center gap-2 text-2xl font-semibold text-ink">
            <Lock size={20} />
            The Vault Page Settings
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Control the public `/vault` teaser page. The Vault is a future paid digital bundle
            distinct from the Early Access Preview list.
          </p>
        </div>
        <span className="pill">Saved with Site Settings</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="field-label">Vault Page Enabled</span>
          <button
            className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition ${
              vaultSettings.is_enabled
                ? "border-[rgba(246,201,69,0.4)] bg-brand-primary-soft text-brand-primary"
                : "border-edge-strong bg-surface text-secondary hover:border-edge hover:bg-surface-hover"
            }`}
            onClick={() => updateVault({is_enabled: !vaultSettings.is_enabled})}
            type="button"
          >
            <span>
              {vaultSettings.is_enabled
                ? "The Vault page is public and accessible."
                : "The Vault page is disabled (redirects to /exclusives)."}
            </span>
            <span className="pill">
              {vaultSettings.is_enabled ? "Enabled" : "Disabled"}
            </span>
          </button>
        </label>

        <label className="space-y-2">
          <span className="field-label">Badge Text</span>
          <input
            className="field-input"
            onChange={(event) => updateVault({badge_text: event.target.value})}
            value={vaultSettings.badge_text}
          />
        </label>

        <label className="space-y-2">
          <span className="field-label">Title</span>
          <input
            className="field-input"
            onChange={(event) => updateVault({title: event.target.value})}
            value={vaultSettings.title}
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label">Subtitle</span>
          <input
            className="field-input"
            onChange={(event) => updateVault({subtitle: event.target.value})}
            value={vaultSettings.subtitle}
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="field-label">Body Text</span>
          <textarea
            className="field-input min-h-[110px]"
            onChange={(event) => updateVault({body: event.target.value})}
            value={vaultSettings.body}
          />
        </label>

        <label className="space-y-2">
          <span className="field-label">CTA Label</span>
          <input
            className="field-input"
            onChange={(event) => updateVault({cta_label: event.target.value})}
            value={vaultSettings.cta_label}
          />
        </label>

        <label className="space-y-2">
          <span className="field-label">CTA URL</span>
          <input
            className="field-input"
            onChange={(event) => updateVault({cta_url: event.target.value})}
            value={vaultSettings.cta_url}
          />
        </label>
      </div>

      <div className="mt-8">
        <p className="field-label mb-4">Vault Benefits</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {vaultSettings.benefits.map((benefit, index) => (
            <div
              className="rounded-lg border border-edge bg-input p-4"
              key={benefit.id || index}
            >
              <p className="field-label">Benefit {index + 1}</p>
              <label className="mt-3 block space-y-2">
                <span className="field-label">Title</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    updateBenefit(index, {title: event.target.value})
                  }
                  value={benefit.title}
                />
              </label>
              <label className="mt-3 block space-y-2">
                <span className="field-label">Description</span>
                <textarea
                  className="field-input min-h-[96px]"
                  onChange={(event) =>
                    updateBenefit(index, {description: event.target.value})
                  }
                  value={benefit.description}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
