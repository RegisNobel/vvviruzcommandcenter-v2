import type {MetadataRoute} from "next";

import {getPublicSiteUrl} from "@/lib/public-site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/admin/",
        "/api/ads/",
        "/api/auth/",
        "/api/campaigns/",
        "/api/copies/",
        "/api/cron/",
        "/api/release-categories/",
        "/api/releases/",
        "/api/site-settings/",
        "/api/subscribers/",
        "/p/",
        "/unsubscribe"
      ]
    },
    sitemap: getPublicSiteUrl("/sitemap.xml")
  };
}
