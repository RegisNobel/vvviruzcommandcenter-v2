import type {Metadata} from "next";

import "@/app/globals.css";

const publicSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  title: "vvviruz",
  description:
    "Official vvviruz artist hub with music releases, artist info, and direct listening links."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#090b0f] text-[#f3eddf] antialiased">{children}</body>
    </html>
  );
}
