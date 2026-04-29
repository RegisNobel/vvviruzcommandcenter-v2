import "server-only";

import {readSiteSettings} from "@/lib/repositories/site-settings";

type CampaignEmailInput = {
  to: string;
  subject: string;
  previewText: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatHtmlBody(value: string) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.7;color:#d7dde4;font-size:15px;">${escapeHtml(
          paragraph
        ).replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

function formatTextBody(value: string) {
  return value.trim();
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required email configuration: ${name}.`);
  }

  return value;
}

function getPublicSiteUrl() {
  return getRequiredEnv("PUBLIC_SITE_URL").replace(/\/+$/, "");
}

function getEmailProvider() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (provider !== "resend") {
    throw new Error("Email sending is not configured. Set EMAIL_PROVIDER=resend.");
  }

  return provider;
}

function getResendConfig() {
  getEmailProvider();

  return {
    apiKey: getRequiredEnv("RESEND_API_KEY"),
    from: getRequiredEnv("EMAIL_FROM")
  };
}

export function getAdminTestEmail() {
  return getRequiredEnv("ADMIN_TEST_EMAIL");
}

export function buildCampaignUnsubscribeUrl(token: string) {
  return `${getPublicSiteUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildExclusivePageUrl() {
  return `${getPublicSiteUrl()}/exclusives`;
}

export async function renderCampaignEmail(input: CampaignEmailInput) {
  const siteSettings = await readSiteSettings();
  const postalAddress = process.env.EMAIL_POSTAL_ADDRESS?.trim();
  const safePreviewText = input.previewText.trim();
  const safeCtaUrl = input.ctaUrl?.trim();
  const safeCtaLabel = input.ctaLabel?.trim();

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#090b0f;color:#f3eddf;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(
      safePreviewText
    )}</span>
    <div style="margin:0 auto;max-width:620px;padding:32px 20px;">
      <div style="border:1px solid rgba(255,255,255,0.08);border-radius:28px;overflow:hidden;background:#0f1217;">
        <div style="padding:32px 32px 20px;background:linear-gradient(135deg,rgba(201,163,71,0.14),rgba(15,18,23,0.96) 58%);">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid rgba(201,163,71,0.26);background:rgba(201,163,71,0.12);color:#d7b45e;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">
            vvviruz update
          </div>
          <h1 style="margin:20px 0 0;font-size:30px;line-height:1.12;color:#f7f1e6;font-weight:700;">${escapeHtml(
            input.subject
          )}</h1>
          ${
            safePreviewText
              ? `<p style="margin:14px 0 0;color:#b9c0c8;font-size:15px;line-height:1.6;">${escapeHtml(
                  safePreviewText
                )}</p>`
              : ""
          }
        </div>
        <div style="padding:28px 32px 32px;">
          ${formatHtmlBody(input.body)}
          ${
            safeCtaLabel && safeCtaUrl
              ? `<div style="margin-top:24px;">
                  <a href="${escapeHtml(
                    safeCtaUrl
                  )}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:#c9a347;color:#13161a;font-weight:700;text-decoration:none;">${escapeHtml(
                    safeCtaLabel
                  )}</a>
                </div>`
              : ""
          }
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding:22px 32px 28px;background:#0b0e12;color:#98a0a8;font-size:12px;line-height:1.7;">
          <p style="margin:0 0 10px;">You’re receiving this because you signed up for vvviruz updates.</p>
          <p style="margin:0 0 10px;">
            <a href="${escapeHtml(
              input.unsubscribeUrl
            )}" style="color:#f0cf7a;text-decoration:none;">Unsubscribe</a>
            ${
              postalAddress
                ? ` &nbsp;•&nbsp; ${escapeHtml(postalAddress)}`
                : ` &nbsp;•&nbsp; ${escapeHtml(siteSettings.contact_email)}`
            }
          </p>
          <p style="margin:0;">${escapeHtml(siteSettings.artist_name)} &nbsp;•&nbsp; ${escapeHtml(
            siteSettings.contact_email
          )}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const textParts = [
    input.subject,
    safePreviewText,
    formatTextBody(input.body),
    safeCtaLabel && safeCtaUrl ? `${safeCtaLabel}: ${safeCtaUrl}` : "",
    `Unsubscribe: ${input.unsubscribeUrl}`,
    postalAddress || siteSettings.contact_email
  ].filter(Boolean);

  return {
    html,
    text: textParts.join("\n\n")
  };
}

export async function sendCampaignEmail(input: CampaignEmailInput) {
  const {apiKey, from} = getResendConfig();
  const {html, text} = await renderCampaignEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html,
      text
    })
  });
  const payload = (await response.json().catch(() => null)) as
    | {id?: string; message?: string; error?: {message?: string}}
    | null;

  if (!response.ok || !payload?.id) {
    throw new Error(
      payload?.error?.message || payload?.message || "Email send failed."
    );
  }

  return {
    providerMessageId: payload.id
  };
}
