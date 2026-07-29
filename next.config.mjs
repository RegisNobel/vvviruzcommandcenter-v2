/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    imageSizes: [48, 96, 160, 400],
    deviceSizes: [800, 1200],
    qualities: [75],
    localPatterns: [
      {
        pathname: "/api/assets/**",
        search: ""
      }
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ],
    formats: ["image/webp"],
    minimumCacheTTL: 2678400
  },
  headers: async () =>
    process.env.NODE_ENV === "production"
      ? [
          {
            source: "/_next/static/:path*",
            headers: [
              {
                key: "Cache-Control",
                value: "public, max-age=31536000, immutable"
              }
            ]
          }
        ]
      : [],
  redirects: async () => [
    {
      source: "/:path*",
      has: [
        {
          type: "host",
          value: "(?:www|admin|api|app|mail)\\.vvviruz\\.com"
        }
      ],
      destination: "https://vvviruz.com/:path*",
      permanent: true
    },
    {
      source: "/",
      has: [
        {
          type: "host",
          value:
            "(?<artist>[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\\.vvviruz\\.com"
        }
      ],
      destination: "https://vvviruz.com/artists/:artist",
      permanent: true
    },
    {
      source: "/:path*",
      has: [
        {
          type: "host",
          value:
            "(?<artist>[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\\.vvviruz\\.com"
        }
      ],
      destination: "https://vvviruz.com/artists/:artist/:path*",
      permanent: true
    },
    {
      source: "/:path*",
      has: [
        {
          type: "host",
          value: "vvviruzcommandcenter-v2.vercel.app"
        }
      ],
      destination: "https://vvviruz.com/:path*",
      permanent: true
    },
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
