"use client";

import Script from "next/script";

type PublicMetaPixelProps = {
  enabled: boolean;
  pixelId: string;
};

function escapeScriptValue(value: string) {
  return JSON.stringify(value);
}

export function PublicMetaPixel({enabled, pixelId}: PublicMetaPixelProps) {
  const normalizedPixelId = pixelId.trim();

  if (!enabled || !normalizedPixelId) {
    return null;
  }

  const initCode = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', ${escapeScriptValue(normalizedPixelId)});
    fbq('track', 'PageView');
  `;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {initCode}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          height="1"
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(
            normalizedPixelId
          )}&ev=PageView&noscript=1`}
          style={{display: "none"}}
          width="1"
        />
      </noscript>
    </>
  );
}
