"use client";

import {Plus, Trash2} from "lucide-react";

import type {SiteContentSettings} from "@/lib/types";
import {createId} from "@/lib/utils";

type CommissionsSettings = SiteContentSettings["commissions"];

type CommissionsSettingsPanelProps = {
  commissionsSettings: CommissionsSettings;
  onChange: (commissions: CommissionsSettings) => void;
};

function serializeOptions(values: string[]) {
  return values.join("\n");
}

function parseOptions(value: string) {
  return value
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean);
}

export function CommissionsSettingsPanel({
  commissionsSettings,
  onChange
}: CommissionsSettingsPanelProps) {
  function updateField<K extends keyof CommissionsSettings>(
    key: K,
    value: CommissionsSettings[K]
  ) {
    onChange({...commissionsSettings, [key]: value});
  }

  function updateService(
    index: number,
    patch: Partial<CommissionsSettings["services"][number]>
  ) {
    updateField(
      "services",
      commissionsSettings.services.map((service, serviceIndex) =>
        serviceIndex === index ? {...service, ...patch} : service
      )
    );
  }

  function addService() {
    updateField("services", [
      ...commissionsSettings.services,
      {id: createId(), title: "New service", description: ""}
    ]);
  }

  return (
    <section className="rounded-lg border border-edge bg-surface-elevated p-4 sm:p-5">
      <div>
        <p className="field-label">Section 15</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">Commissions Page</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Manage availability, public services, quote and legal copy, form options,
          success text, and search metadata from one place.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        <label className="flex items-center gap-3">
          <input
            checked={commissionsSettings.is_enabled}
            className="h-4 w-4 rounded border-edge bg-input text-brand-primary focus:ring-brand-primary"
            onChange={(event) => updateField("is_enabled", event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-medium text-ink">Accepting commission requests</span>
        </label>

        <div className={commissionsSettings.is_enabled ? "state-panel-success" : "state-panel-warning"}>
          <p className="font-semibold">
            {commissionsSettings.is_enabled ? "Requests open" : "Closed page active"}
          </p>
          <p className="mt-1 text-sm">
            {commissionsSettings.is_enabled
              ? "Visitors can view the configured services and submit the request form."
              : "Visitors see the configured closed state, and the server rejects direct submissions."}
          </p>
        </div>

        <fieldset className="grid gap-5 rounded-lg border border-edge bg-input p-4 md:grid-cols-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Search metadata
          </legend>
          <label className="space-y-2">
            <span className="field-label">Page title</span>
            <input className="field-input" onChange={(event) => updateField("metadata_title", event.target.value)} value={commissionsSettings.metadata_title}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Description while open</span>
            <textarea className="field-input min-h-20" onChange={(event) => updateField("metadata_open_description", event.target.value)} value={commissionsSettings.metadata_open_description}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Description while closed</span>
            <textarea className="field-input min-h-20" onChange={(event) => updateField("metadata_closed_description", event.target.value)} value={commissionsSettings.metadata_closed_description}/>
          </label>
        </fieldset>

        <fieldset className="grid gap-5 rounded-lg border border-edge bg-input p-4 md:grid-cols-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Open-page introduction
          </legend>
          <label className="space-y-2">
            <span className="field-label">Eyebrow</span>
            <input className="field-input" onChange={(event) => updateField("page_eyebrow", event.target.value)} value={commissionsSettings.page_eyebrow}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Title</span>
            <input className="field-input" onChange={(event) => updateField("page_title", event.target.value)} value={commissionsSettings.page_title}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Subtitle</span>
            <textarea className="field-input min-h-20" onChange={(event) => updateField("page_subtitle", event.target.value)} value={commissionsSettings.page_subtitle}/>
          </label>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-edge bg-input p-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Public services
          </legend>
          {commissionsSettings.services.map((service, index) => (
            <div className="grid gap-3 rounded-lg border border-edge bg-surface p-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]" key={service.id}>
              <label className="space-y-2">
                <span className="field-label">Service {index + 1}</span>
                <input className="field-input" onChange={(event) => updateService(index, {title: event.target.value})} value={service.title}/>
              </label>
              <label className="space-y-2">
                <span className="field-label">Description</span>
                <textarea className="field-input min-h-24" onChange={(event) => updateService(index, {description: event.target.value})} value={service.description}/>
              </label>
              <button
                aria-label={`Remove ${service.title}`}
                className="action-button-secondary self-end !px-3"
                onClick={() => updateField("services", commissionsSettings.services.filter((_, serviceIndex) => serviceIndex !== index))}
                type="button"
              >
                <Trash2 size={15}/>
              </button>
            </div>
          ))}
          <button className="action-button-secondary" onClick={addService} type="button">
            <Plus size={15}/> Add service
          </button>
        </fieldset>

        <fieldset className="grid gap-5 rounded-lg border border-edge bg-input p-4 md:grid-cols-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quote and terms
          </legend>
          <label className="space-y-2">
            <span className="field-label">Quote eyebrow</span>
            <input className="field-input" onChange={(event) => updateField("quote_eyebrow", event.target.value)} value={commissionsSettings.quote_eyebrow}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Quote description</span>
            <textarea className="field-input min-h-24" onChange={(event) => updateField("quote_description", event.target.value)} value={commissionsSettings.quote_description}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Creative-fit note</span>
            <textarea className="field-input min-h-24" onChange={(event) => updateField("terms_primary", event.target.value)} value={commissionsSettings.terms_primary}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Booking, rights, and payment terms</span>
            <textarea className="field-input min-h-28" onChange={(event) => updateField("terms_secondary", event.target.value)} value={commissionsSettings.terms_secondary}/>
          </label>
        </fieldset>

        <fieldset className="grid gap-5 rounded-lg border border-edge bg-input p-4 md:grid-cols-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Form copy and options
          </legend>
          {([
            ["form_heading", "Form heading"],
            ["form_success_heading", "Success heading"],
            ["submit_label", "Submit button"],
            ["submitting_label", "Submitting state"],
            ["name_label", "Name label"],
            ["name_placeholder", "Name placeholder"],
            ["email_label", "Email label"],
            ["email_placeholder", "Email placeholder"],
            ["request_type_label", "Request type label"],
            ["request_type_placeholder", "Request type placeholder"],
            ["other_service_label", "Other service label"],
            ["budget_label", "Budget label"],
            ["budget_placeholder", "Budget placeholder"],
            ["usage_label", "Usage label"],
            ["usage_placeholder", "Usage placeholder"],
            ["deadline_label", "Deadline label"],
            ["deadline_placeholder", "Deadline placeholder"],
            ["specific_date_label", "Specific date label"],
            ["specific_date_placeholder", "Specific date placeholder"],
            ["topic_label", "Topic label"],
            ["beat_link_label", "Beat link label"],
            ["reference_link_label", "Reference link label"],
            ["notes_label", "Notes label"]
          ] as const).map(([key, label]) => (
            <label className="space-y-2" key={key}>
              <span className="field-label">{label}</span>
              <input className="field-input" onChange={(event) => updateField(key, event.target.value)} value={commissionsSettings[key]}/>
            </label>
          ))}
          {([
            ["topic_placeholder", "Topic placeholder"],
            ["beat_link_placeholder", "Beat link placeholder"],
            ["reference_link_placeholder", "Reference link placeholder"],
            ["notes_placeholder", "Notes placeholder"],
            ["form_disclaimer", "Form disclaimer"]
          ] as const).map(([key, label]) => (
            <label className="space-y-2 md:col-span-2" key={key}>
              <span className="field-label">{label}</span>
              <textarea className="field-input min-h-20" onChange={(event) => updateField(key, event.target.value)} value={commissionsSettings[key]}/>
            </label>
          ))}
          {([
            ["budget_options", "Budget options"],
            ["usage_options", "Usage options"],
            ["deadline_options", "Deadline options"]
          ] as const).map(([key, label]) => (
            <label className="space-y-2" key={key}>
              <span className="field-label">{label} (one per line)</span>
              <textarea className="field-input min-h-36" onChange={(event) => updateField(key, parseOptions(event.target.value))} value={serializeOptions(commissionsSettings[key])}/>
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-5 rounded-lg border border-edge bg-input p-4 md:grid-cols-2">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Closed state
          </legend>
          <label className="space-y-2">
            <span className="field-label">Eyebrow</span>
            <input className="field-input" onChange={(event) => updateField("closed_eyebrow", event.target.value)} value={commissionsSettings.closed_eyebrow}/>
          </label>
          <label className="space-y-2">
            <span className="field-label">Heading</span>
            <input className="field-input" onChange={(event) => updateField("closed_heading", event.target.value)} value={commissionsSettings.closed_heading}/>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">Message</span>
            <textarea className="field-input min-h-20" onChange={(event) => updateField("closed_message", event.target.value)} value={commissionsSettings.closed_message}/>
          </label>
          <label className="space-y-2">
            <span className="field-label">Catalog CTA</span>
            <input className="field-input" onChange={(event) => updateField("closed_cta_label", event.target.value)} value={commissionsSettings.closed_cta_label}/>
          </label>
        </fieldset>
      </div>
    </section>
  );
}
