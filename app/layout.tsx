import type { Metadata } from "next";
import { headers } from "next/headers";
import { withBasePath } from "@/lib/base-path";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "Sunday School | Faith Presbyterian Church",
    description: "Sunday School classes, Bible studies, schedules, study materials, and resources from Faith Presbyterian Church.",
    icons: { icon: withBasePath("/icon.png") },
    openGraph: {
      title: "Faith Presbyterian Church Sunday School",
      description: "Bible study, class resources, schedules, and materials from Faith Presbyterian Church Sunday School.",
      type: "website",
      url: withBasePath("/"),
      images: [{ url: withBasePath("/og.png"), width: 1536, height: 1024, alt: "Faith Presbyterian Church — The Gospel of John — Come and See" }],
    },
    twitter: { card: "summary_large_image", title: "Faith Presbyterian Church Sunday School", description: "Bible study, class resources, schedules, and materials from Faith Presbyterian Church Sunday School.", images: [withBasePath("/og.png")] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
