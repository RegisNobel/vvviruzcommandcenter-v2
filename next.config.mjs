/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.blob.vercel-storage.com"
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com"
      },
      {
        protocol: "https",
        hostname: "i.scdn.co"
      },
      {
        protocol: "https",
        hostname: "is*-ssl.mzstatic.com"
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com"
      }
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400
  },
  headers: async () => [
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  redirects: async () => [
    {
      source: "/admin/analytics",
      destination: "/admin/attribution",
      permanent: true
    },
    {
      source: "/admin/analytics/:path*",
      destination: "/admin/attribution/:path*",
      permanent: true
    },
    {
      source: "/admin/ads",
      destination: "/admin/ad-lab",
      permanent: true
    },
    {
      source: "/admin/ads/:path*",
      destination: "/admin/ad-lab/:path*",
      permanent: true
    }
  ]
};

export default nextConfig;
