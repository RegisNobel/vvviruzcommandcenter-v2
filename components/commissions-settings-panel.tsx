"use client";

import type {SiteContentSettings} from "@/lib/types";

type CommissionsSettingsPanelProps = {
  commissionsSettings: SiteContentSettings["commissions"];
  onChange: (commissions: SiteContentSettings["commissions"]) => void;
};

export function CommissionsSettingsPanel({
  commissionsSettings,
  onChange
}: CommissionsSettingsPanelProps) {
  function updateField<K extends keyof SiteContentSettings["commissions"]>(
    key: K,
    value: SiteContentSettings["commissions"][K]
  ) {
    onChange({
      ...commissionsSettings,
      [key]: value
    });
  }

  return (
    <section className="rounded-[24px] border border-[#30343b] bg-[#121418] p-4 sm:p-5">
      <div>
        <p className="field-label">Section 15</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">Commissions Page</h3>
      </div>

      <div className="mt-6 space-y-6">
        <label className="flex items-center gap-3">
          <input
            checked={commissionsSettings.is_enabled}
            className="h-4 w-4 rounded border-gray-300 text-[#c9a347] focus:ring-[#c9a347]"
            onChange={(e) => updateField("is_enabled", e.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-medium text-ink">Commissions Page Enabled</span>
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="field-label">Page Eyebrow</span>
            <input
              className="field-input"
              onChange={(e) => updateField("page_eyebrow", e.target.value)}
              value={commissionsSettings.page_eyebrow}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Page Title</span>
            <input
              className="field-input"
              onChange={(e) => updateField("page_title", e.target.value)}
              value={commissionsSettings.page_title}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Page Subtitle</span>
            <textarea
              className="field-input min-h-[80px]"
              onChange={(e) => updateField("page_subtitle", e.target.value)}
              value={commissionsSettings.page_subtitle}
            />
          </label>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 md:col-span-2">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Unified Service Card</h4>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Card Title</span>
                <input
                  className="field-input"
                  onChange={(e) => updateField("card_title", e.target.value)}
                  value={commissionsSettings.card_title}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Card Price</span>
                <input
                  className="field-input"
                  onChange={(e) => updateField("card_price", e.target.value)}
                  value={commissionsSettings.card_price}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="field-label">Card Description</span>
                <textarea
                  className="field-input min-h-[80px]"
                  onChange={(e) => updateField("card_description", e.target.value)}
                  value={commissionsSettings.card_description}
                />
              </label>

              <label className="space-y-2">
                <span className="field-label">Card Button Text</span>
                <input
                  className="field-input"
                  onChange={(e) => updateField("card_button_text", e.target.value)}
                  value={commissionsSettings.card_button_text}
                />
              </label>
            </div>
          </div>

          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Commissions Closed Message</span>
            <input
              className="field-input"
              onChange={(e) => updateField("closed_message", e.target.value)}
              value={commissionsSettings.closed_message}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
