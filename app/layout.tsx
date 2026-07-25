import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "Faith-Presbyterian-Gospel-of-John",
    description: "Study resources, weekly passages, reflection questions, and a class outline for exploring the Gospel of John.",
    icons: { icon: "/icon.png" },
    openGraph: {
      title: "The Gospel of John — Come and See",
      description: "Resources for a Faith Presbyterian Church Sunday School study of the Gospel of John.",
      type: "website",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Faith Presbyterian Church — The Gospel of John — Come and See" }],
    },
    twitter: { card: "summary_large_image", title: "The Gospel of John — Come and See", description: "Faith Presbyterian Church Sunday School resources", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
